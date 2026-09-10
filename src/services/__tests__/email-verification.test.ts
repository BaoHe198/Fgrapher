import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emailIdempotencyKey } from "@/services/email-outbox-policy";
import {
  type EmailVerificationStore,
  createEmailVerificationToken,
  hashVerificationToken,
  verifyEmailToken,
} from "@/services/email-verification";

// Exercises the real verifyEmailToken() against an in-memory store that
// models the one property the production store must have: `consume` is
// atomic, so of two callers racing for the same token exactly one wins.
//
// The interleaving here is real, not simulated — each store method awaits,
// so two `verifyEmailToken` calls started together genuinely suspend at the
// same points the production code does. That's what makes this a test of
// the service's read-then-write structure rather than of Postgres.

interface StoreState {
  tokens: Map<string, { id: string; userId: string; expiresAt: Date }>;
  users: Map<
    string,
    { email: string; emailVerified: Date | null; deletedAt: Date | null }
  >;
  // The row id is stable per user, exactly as the upsert-on-userId in the
  // Prisma store makes it. That stability is what made keying the outbox on
  // the row id wrong.
  tokenRowIds: Map<string, string>;
  consumeCalls: number;
}

function makeStore(state: StoreState): EmailVerificationStore {
  // Forces a suspension point so concurrent callers actually interleave
  // rather than running to completion one after the other.
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  return {
    async issue({ userId, tokenHash, expiresAt }) {
      await tick();
      // Models the unique constraint on userId: issuing replaces, never
      // accumulates, so at most one token per user can ever be live.
      for (const [hash, token] of state.tokens) {
        if (token.userId === userId) state.tokens.delete(hash);
      }
      const id = state.tokenRowIds.get(userId) ?? `tok_${userId}`;
      state.tokenRowIds.set(userId, id);
      state.tokens.set(tokenHash, { id, userId, expiresAt });
      return { id, expiresAt };
    },

    async findByHash(tokenHash) {
      await tick();
      const token = state.tokens.get(tokenHash);
      if (!token) return null;
      const user = state.users.get(token.userId);
      if (!user) return null;
      return { ...token, user: { ...user } };
    },

    async consume(tokenId, userId, verifiedAt) {
      state.consumeCalls += 1;
      await tick();
      // The atomic step. Everything between finding the hash and here can
      // interleave freely; this cannot, which is exactly the guarantee the
      // Prisma implementation gets from deleting inside a transaction.
      let deleted = false;
      for (const [hash, token] of state.tokens) {
        if (token.id === tokenId) {
          state.tokens.delete(hash);
          deleted = true;
          break;
        }
      }
      if (!deleted) return false;

      const user = state.users.get(userId);
      if (user) user.emailVerified = verifiedAt;
      return true;
    },

    async discard(tokenId) {
      await tick();
      for (const [hash, token] of state.tokens) {
        if (token.id === tokenId) {
          state.tokens.delete(hash);
          break;
        }
      }
    },

    async getVerificationState(userId) {
      await tick();
      const user = state.users.get(userId);
      return user ? { emailVerified: user.emailVerified } : null;
    },
  };
}

const RAW_TOKEN = "a".repeat(64);

function seed(
  overrides: {
    expiresAt?: Date;
    emailVerified?: Date | null;
    deletedAt?: Date | null;
  } = {},
): StoreState {
  return {
    tokens: new Map([
      [
        hashVerificationToken(RAW_TOKEN),
        {
          id: "tok_1",
          userId: "usr_1",
          expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60_000),
        },
      ],
    ]),
    users: new Map([
      [
        "usr_1",
        {
          email: "nguyen@example.com",
          emailVerified: overrides.emailVerified ?? null,
          deletedAt: overrides.deletedAt ?? null,
        },
      ],
    ]),
    tokenRowIds: new Map([["usr_1", "tok_1"]]),
    consumeCalls: 0,
  };
}

function emptyState(): StoreState {
  return {
    tokens: new Map(),
    users: new Map([
      [
        "usr_1",
        { email: "nguyen@example.com", emailVerified: null, deletedAt: null },
      ],
    ]),
    tokenRowIds: new Map(),
    consumeCalls: 0,
  };
}

describe("verifyEmailToken", () => {
  it("verifies a valid token and consumes it", async () => {
    const state = seed();
    const store = makeStore(state);

    const result = await verifyEmailToken(RAW_TOKEN, store);

    assert.deepEqual(result, {
      status: "verified",
      email: "nguyen@example.com",
    });
    assert.equal(state.tokens.size, 0, "token must be single-use");
    assert.ok(state.users.get("usr_1")?.emailVerified);
  });

  it("stores only the hash, so the raw token is not a lookup key", () => {
    const state = seed();
    assert.ok(!state.tokens.has(RAW_TOKEN));
    assert.ok(state.tokens.has(hashVerificationToken(RAW_TOKEN)));
  });

  it("rejects an unknown token", async () => {
    const result = await verifyEmailToken("b".repeat(64), makeStore(seed()));
    assert.deepEqual(result, { status: "invalid" });
  });

  it("rejects an empty token without touching the store", async () => {
    const state = seed();
    const result = await verifyEmailToken("", makeStore(state));
    assert.deepEqual(result, { status: "invalid" });
    assert.equal(state.consumeCalls, 0);
  });

  it("reports an expired token and clears it", async () => {
    const state = seed({ expiresAt: new Date(Date.now() - 1000) });
    const result = await verifyEmailToken(RAW_TOKEN, makeStore(state));

    assert.deepEqual(result, { status: "expired" });
    assert.equal(state.tokens.size, 0);
    assert.equal(state.users.get("usr_1")?.emailVerified, null);
    assert.equal(state.consumeCalls, 0, "an expired token must not verify");
  });

  it("does not verify a soft-deleted user", async () => {
    const state = seed({ deletedAt: new Date() });
    const result = await verifyEmailToken(RAW_TOKEN, makeStore(state));

    assert.deepEqual(result, { status: "invalid" });
    assert.equal(state.consumeCalls, 0);
    assert.equal(state.users.get("usr_1")?.emailVerified, null);
  });
});

describe("verifyEmailToken — replay", () => {
  it("reports a reused token as already verified, not as an error", async () => {
    const state = seed();
    const store = makeStore(state);

    const first = await verifyEmailToken(RAW_TOKEN, store);
    const second = await verifyEmailToken(RAW_TOKEN, store);

    assert.equal(first.status, "verified");
    // The row is gone, so a replay is indistinguishable from a bad token —
    // which is the correct, non-enumerable answer.
    assert.deepEqual(second, { status: "invalid" });
  });

  it("reports a still-live token for an already-verified user as already_verified", async () => {
    // Reachable when a second token was issued before the first was used.
    const state = seed({ emailVerified: new Date() });
    const result = await verifyEmailToken(RAW_TOKEN, makeStore(state));

    assert.equal(result.status, "already_verified");
    assert.equal(state.consumeCalls, 0, "must not re-stamp emailVerified");
    assert.equal(state.tokens.size, 0, "the stale token must be cleared");
  });
});

describe("createEmailVerificationToken — resend identity", () => {
  // The outbox key must identify the *issuance*, not the user. Keying it on
  // the token row's id looked right but the row is upserted on userId, so
  // its id never changes: every resend after the first collided with the
  // first outbox row, meaning a failed resend was never queued for retry
  // and a delivered one was never recorded.
  it("gives two resends distinct idempotency keys", async () => {
    const state = emptyState();
    const store = makeStore(state);

    const first = await createEmailVerificationToken("usr_1", store);
    const second = await createEmailVerificationToken("usr_1", store);

    assert.notEqual(first.rawToken, second.rawToken);
    assert.notEqual(first.tokenHash, second.tokenHash);
    assert.notEqual(
      emailIdempotencyKey("email-verification", first.tokenHash),
      emailIdempotencyKey("email-verification", second.tokenHash),
      "each resend must be a distinct outbox event",
    );
  });

  it("keeps the row id stable across resends, which is why it cannot be the key", async () => {
    const state = emptyState();
    const store = makeStore(state);

    const first = await createEmailVerificationToken("usr_1", store);
    const second = await createEmailVerificationToken("usr_1", store);

    assert.equal(first.tokenId, second.tokenId);
  });

  it("leaves only the newest token valid", async () => {
    const state = emptyState();
    const store = makeStore(state);

    const first = await createEmailVerificationToken("usr_1", store);
    const second = await createEmailVerificationToken("usr_1", store);

    assert.equal(state.tokens.size, 1, "a user has one outstanding token");

    const stale = await verifyEmailToken(first.rawToken, store);
    assert.deepEqual(stale, { status: "invalid" });
    assert.equal(state.users.get("usr_1")?.emailVerified, null);

    const fresh = await verifyEmailToken(second.rawToken, store);
    assert.equal(fresh.status, "verified");
  });

  it("leaves one token live when two resends race", async () => {
    const state = emptyState();
    const store = makeStore(state);

    const [a, b] = await Promise.all([
      createEmailVerificationToken("usr_1", store),
      createEmailVerificationToken("usr_1", store),
    ]);

    assert.equal(state.tokens.size, 1);
    assert.notEqual(a.tokenHash, b.tokenHash);

    // Exactly one of the two emailed links works. This is the known UX
    // cost of "one outstanding token per user" — see the resend copy,
    // which tells the user to open the most recent email.
    const results = [
      await verifyEmailToken(a.rawToken, store),
      await verifyEmailToken(b.rawToken, store),
    ];
    assert.equal(results.filter((r) => r.status === "verified").length, 1);
  });

  it("issues tokens long enough to be unguessable", async () => {
    const { rawToken } = await createEmailVerificationToken(
      "usr_1",
      makeStore(emptyState()),
    );
    // 32 random bytes, hex-encoded.
    assert.match(rawToken, /^[0-9a-f]{64}$/);
  });
});

describe("verifyEmailToken — concurrency", () => {
  it("lets exactly one of two simultaneous requests consume the token", async () => {
    const state = seed();
    const store = makeStore(state);

    const [a, b] = await Promise.all([
      verifyEmailToken(RAW_TOKEN, store),
      verifyEmailToken(RAW_TOKEN, store),
    ]);

    // Both callers read the token before either consumed it — that's the
    // window the read-then-write version had.
    assert.equal(state.consumeCalls, 2, "both requests raced to consume");

    const statuses = [a.status, b.status].sort();
    assert.deepEqual(
      statuses,
      ["already_verified", "verified"],
      "exactly one request may report a fresh verification",
    );
    assert.equal(state.tokens.size, 0);
    assert.ok(state.users.get("usr_1")?.emailVerified);
  });

  it("holds under a burst of simultaneous requests", async () => {
    const state = seed();
    const store = makeStore(state);

    const results = await Promise.all(
      Array.from({ length: 8 }, () => verifyEmailToken(RAW_TOKEN, store)),
    );

    const verified = results.filter((r) => r.status === "verified");
    assert.equal(verified.length, 1, "the token must be consumed once");
    assert.ok(
      results.every(
        (r) => r.status === "verified" || r.status === "already_verified",
      ),
      "no request should see a failure for a legitimate token",
    );
    // The account ends up verified exactly once, whichever request won.
    assert.ok(state.users.get("usr_1")?.emailVerified);
  });

  it("does not claim already_verified when a lost consume verified nobody", async () => {
    // Models the token vanishing between the read and the consume for a
    // reason other than a concurrent verification — an admin purge, a
    // cascade from account deletion. Reporting "already verified" here
    // would tell the user to go and sign in to an account that still
    // can't sign in.
    const state = seed();
    const store = makeStore(state);
    const original = store.consume.bind(store);
    store.consume = async (tokenId, userId, at) => {
      state.tokens.clear();
      return original(tokenId, userId, at);
    };

    const result = await verifyEmailToken(RAW_TOKEN, store);

    assert.deepEqual(result, { status: "invalid" });
    assert.equal(
      state.users.get("usr_1")?.emailVerified,
      null,
      "a lost consume must not mark the user verified",
    );
  });

  it("reports already_verified when the race was lost to a real verification", async () => {
    const state = seed();
    const store = makeStore(state);
    const original = store.consume.bind(store);
    store.consume = async (tokenId, userId, at) => {
      // Another request got there first and did verify the account.
      state.tokens.clear();
      const user = state.users.get(userId);
      if (user) user.emailVerified = at;
      return original(tokenId, userId, at);
    };

    const result = await verifyEmailToken(RAW_TOKEN, store);

    assert.equal(result.status, "already_verified");
  });
});
