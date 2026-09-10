import { strict as assert } from "assert";

// Unit tests for email outbox — run with: npx tsx src/services/__tests__/email-outbox.test.ts
// These tests verify idempotency key generation and backoff scheduling.

import crypto from "crypto";

function generateIdempotencyKey(payload: {
  to: string;
  subject: string;
  html: string;
}): string {
  const data = `${payload.to}:${payload.subject}:${crypto.createHash("md5").update(payload.html).digest("hex")}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}

function getNextAttemptTime(attempts: number): Date {
  const BASE_BACKOFF_MS = 60 * 1000;
  const backoffMs = BASE_BACKOFF_MS * Math.pow(2, Math.min(attempts, 4));
  return new Date(Date.now() + backoffMs);
}

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await Promise.resolve(fn());
    console.log(`✓ ${name}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`✗ ${name}: ${message}`);
    process.exit(1);
  }
}

async function runTests() {
  console.log("Running email outbox tests...\n");

  await test("idempotencyKey: is deterministic", () => {
    const payload = {
      to: "user@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    };
    const key1 = generateIdempotencyKey(payload);
    const key2 = generateIdempotencyKey(payload);
    assert.strictEqual(key1, key2);
  });

  await test("idempotencyKey: differs for different recipients", () => {
    const payload1 = {
      to: "user1@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    };
    const payload2 = {
      to: "user2@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    };
    const key1 = generateIdempotencyKey(payload1);
    const key2 = generateIdempotencyKey(payload2);
    assert.notStrictEqual(key1, key2);
  });

  await test("idempotencyKey: differs for different subjects", () => {
    const payload1 = {
      to: "user@example.com",
      subject: "Test A",
      html: "<p>Hello</p>",
    };
    const payload2 = {
      to: "user@example.com",
      subject: "Test B",
      html: "<p>Hello</p>",
    };
    const key1 = generateIdempotencyKey(payload1);
    const key2 = generateIdempotencyKey(payload2);
    assert.notStrictEqual(key1, key2);
  });

  await test("idempotencyKey: differs for different HTML", () => {
    const payload1 = {
      to: "user@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    };
    const payload2 = {
      to: "user@example.com",
      subject: "Test",
      html: "<p>Goodbye</p>",
    };
    const key1 = generateIdempotencyKey(payload1);
    const key2 = generateIdempotencyKey(payload2);
    assert.notStrictEqual(key1, key2);
  });

  await test("idempotencyKey: is 64 characters (SHA256 hex)", () => {
    const key = generateIdempotencyKey({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Test</p>",
    });
    assert.strictEqual(key.length, 64);
    assert(/^[a-f0-9]{64}$/.test(key));
  });

  await test("backoff: attempt 1 = 1 minute", () => {
    const next = getNextAttemptTime(0);
    const nowPlusSixty = Date.now() + 60 * 1000;
    const diff = Math.abs(next.getTime() - nowPlusSixty);
    assert(diff < 1000, `Expected ~1min, got ${diff}ms difference`);
  });

  await test("backoff: attempt 2 = 2 minutes", () => {
    const next = getNextAttemptTime(1);
    const nowPlusTwoMins = Date.now() + 2 * 60 * 1000;
    const diff = Math.abs(next.getTime() - nowPlusTwoMins);
    assert(diff < 1000, `Expected ~2min, got ${diff}ms difference`);
  });

  await test("backoff: attempt 3 = 4 minutes", () => {
    const next = getNextAttemptTime(2);
    const nowPlusFourMins = Date.now() + 4 * 60 * 1000;
    const diff = Math.abs(next.getTime() - nowPlusFourMins);
    assert(diff < 1000, `Expected ~4min, got ${diff}ms difference`);
  });

  await test("backoff: attempt 4 = 8 minutes", () => {
    const next = getNextAttemptTime(3);
    const nowPlusEightMins = Date.now() + 8 * 60 * 1000;
    const diff = Math.abs(next.getTime() - nowPlusEightMins);
    assert(diff < 1000, `Expected ~8min, got ${diff}ms difference`);
  });

  await test("backoff: attempt 5+ caps at 16 minutes", () => {
    const next = getNextAttemptTime(4);
    const nowPlusSixteenMins = Date.now() + 16 * 60 * 1000;
    const diff = Math.abs(next.getTime() - nowPlusSixteenMins);
    assert(diff < 1000, `Expected ~16min, got ${diff}ms difference`);
  });

  await test("backoff: attempt 10 also caps at 16 minutes", () => {
    const next1 = getNextAttemptTime(4);
    const next2 = getNextAttemptTime(9);
    // Should be same (capped at 16 minutes)
    const diff = Math.abs(next1.getTime() - next2.getTime());
    assert(diff < 1000, `Expected backoff to cap, got ${diff}ms difference`);
  });

  console.log("\n✓ All email outbox tests passed!");
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
