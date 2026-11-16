import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { checkSharedRateLimit } from "@/lib/rate-limit";

const LIMIT = { max: 2, windowMs: 60_000 };
const realFetch = globalThis.fetch;
let calls: { url: string; body: unknown[] }[] = [];

function upstashReplies(...results: unknown[]) {
  let i = 0;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    const result = results[Math.min(i++, results.length - 1)];
    if (result instanceof Error) throw result;
    return new Response(JSON.stringify({ result }), { status: 200 });
  }) as typeof fetch;
}

describe("checkSharedRateLimit", () => {
  beforeEach(() => {
    calls = [];
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("counts in memory when Upstash is not configured", async () => {
    upstashReplies([1, 60_000]);
    const key = `t-local-${Math.random()}`;
    assert.equal((await checkSharedRateLimit(key, LIMIT)).allowed, true);
    assert.equal((await checkSharedRateLimit(key, LIMIT)).allowed, true);
    assert.equal((await checkSharedRateLimit(key, LIMIT)).allowed, false);
    assert.equal(calls.length, 0);
  });

  it("uses the shared count when configured, one EVAL per check", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    upstashReplies([2, 30_000], [3, 29_400]);
    const key = `t-shared-${Math.random()}`;
    assert.deepEqual(await checkSharedRateLimit(key, LIMIT), {
      allowed: true,
      retryAfterSeconds: 0,
    });
    assert.deepEqual(await checkSharedRateLimit(key, LIMIT), {
      allowed: false,
      retryAfterSeconds: 30,
    });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].body[0], "EVAL");
    assert.match(String(calls[0].body[3]), new RegExp(`^rl:.+:${key}$`));
    assert.equal(calls[0].body[4], "60000");
  });

  it("falls back to memory when Upstash fails, never blocking by error", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    upstashReplies(new Error("network down"));
    const key = `t-down-${Math.random()}`;
    assert.equal((await checkSharedRateLimit(key, LIMIT)).allowed, true);
    assert.equal((await checkSharedRateLimit(key, LIMIT)).allowed, true);
    assert.equal((await checkSharedRateLimit(key, LIMIT)).allowed, false);
  });

  it("treats an unexpected reply as a failure", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    upstashReplies("OK");
    const key = `t-odd-${Math.random()}`;
    assert.equal((await checkSharedRateLimit(key, LIMIT)).allowed, true);
  });
});
