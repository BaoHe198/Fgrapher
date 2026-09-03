// In-memory fixed-window rate limiter — no Redis/Upstash in this project
// (CLAUDE.md, deliberately skipped at this scale). This only protects a
// single warm serverless instance: it resets on cold start and doesn't
// coordinate across concurrent instances, so a distributed/highly parallel
// attacker can still get more attempts through than the limit implies.
// Still meaningfully raises the bar against the realistic threat here — a
// simple scripted loop from one source — which today has zero resistance
// at all. Revisit with a shared store (Upstash Redis, or a DB-backed
// counter table) if real abuse is observed or scale grows past one
// instance actually mattering.
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

// x-forwarded-for is a comma-separated list when the request passed
// through multiple proxies — the first entry is the original client.
// Falls back to a constant so a request with no header at all still gets
// bucketed together (better than throwing/skipping the check entirely).
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  );
}
