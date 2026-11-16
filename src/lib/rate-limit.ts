// Two fixed-window rate limiters.
//
// checkRateLimit: in-memory, per serverless instance. It resets on cold
// start and doesn't coordinate across concurrent instances, so a
// distributed attacker gets more attempts than the limit implies. Used for
// the high-volume read endpoints (search, map) and proxy.ts's global API
// ceiling, where a coarse per-instance limit is enough and a network round
// trip on every call would cost more than it protects.
//
// checkSharedRateLimit: one counter for all instances, kept in Upstash
// Redis (REST API, no client library) when UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN are set — owner checklist #18. Used where
// abuse actually costs something: sign-in, sign-up, password reset, email
// verification, contact, SMS codes, payment creation. One Redis command
// per check. Without the variables, or if Upstash errors or is slow, it
// falls back to the in-memory limiter: a broken store never locks anyone
// out, it only loses the cross-instance guarantee.

import { getRequestIp } from "@/lib/request-meta";

const buckets = new Map<string, { count: number; resetAt: number }>();

// Buckets are never actively evicted otherwise, so a long-running instance
// would slowly accumulate one entry per distinct key (IP, email, ...)
// forever. Sweep expired entries periodically rather than on every call.
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
let lastSweep = Date.now();
function sweepExpired(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * key should already include the bucket's own namespace (e.g.
 * `login:${email}`, `register:${ip}`) so unrelated limiters can't collide.
 */
export function checkRateLimit(
  key: string,
  { max, windowMs }: { max: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  sweepExpired(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= max) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

// Falls back to a constant so a request with no header at all still gets
// bucketed together (better than throwing/skipping the check entirely).
export function getClientIp(request: Request): string {
  return getRequestIp(request) ?? "unknown";
}

// INCR, then set the expiry on the window's first hit; one EVAL is one
// Upstash command. Returns [count, milliseconds left in the window].
const WINDOW_SCRIPT = `local c = redis.call('INCR', KEYS[1])
if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); ttl = tonumber(ARGV[1]) end
return {c, ttl}`;

const SHARED_TIMEOUT_MS = 800;
let lastSharedErrorLog = 0;

function reportSharedFailure(error: unknown) {
  const now = Date.now();
  if (now - lastSharedErrorLog < 60_000) return;
  lastSharedErrorLog = now;
  console.error("[rate-limit] Upstash unavailable, using in-memory limit", {
    error: error instanceof Error ? error.message : String(error),
  });
}

/**
 * Same contract as checkRateLimit, counted across every instance when
 * Upstash is configured. Keys are namespaced by APP_ENV so preview and
 * production can share one Upstash database without sharing counters.
 */
export async function checkSharedRateLimit(
  key: string,
  limit: { max: number; windowMs: number },
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return checkRateLimit(key, limit);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        "EVAL",
        WINDOW_SCRIPT,
        "1",
        `rl:${process.env.APP_ENV ?? "development"}:${key}`,
        String(limit.windowMs),
      ]),
      signal: AbortSignal.timeout(SHARED_TIMEOUT_MS),
      cache: "no-store",
    });
    const body = (await res.json()) as { result?: unknown; error?: string };
    if (
      !res.ok ||
      !Array.isArray(body.result) ||
      typeof body.result[0] !== "number" ||
      typeof body.result[1] !== "number"
    ) {
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    const [count, ttlMs] = body.result as [number, number];
    if (count > limit.max) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(ttlMs / 1000)),
      };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  } catch (error) {
    reportSharedFailure(error);
    return checkRateLimit(key, limit);
  }
}
