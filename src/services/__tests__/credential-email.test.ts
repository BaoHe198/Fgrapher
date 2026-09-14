import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import type { Prisma } from "@prisma/client";

import type { SendEmailInput } from "@/lib/email";

import {
  type CredentialLockedOps,
  type CredentialStore,
  type CredentialTokenWrite,
  CLAIM_FIELDS,
  SUPERSEDED_ERROR,
  SUPERSEDED_FIELDS,
  claimCredentialRow,
  hashCredentialToken,
  isResetIssuanceCurrent,
  isVerificationIssuanceCurrent,
  issueCredential,
} from "@/services/credential-email";
import { finalizeReservedEmail } from "@/services/email-outbox";
import {
  type CredentialEmailType,
  type CredentialIssuance,
  credentialEmailKey,
  credentialScopePrefix,
  parseCredentialEmailKey,
} from "@/services/email-outbox-policy";
import { sendPasswordResetEmail } from "@/services/password-reset";

// Exercises the real issueCredential / finalizeReservedEmail /
// claimCredentialRow against an in-memory store that models what the
// Prisma store must provide:
//   1. withLock serialises callers for the same (type, account) — an
//      advisory xact lock in production — and nothing else.
//   2. Rows are filtered by the same where-objects production passes to
//      Prisma (supersedableWhere, claimableWhere), so a scoping mistake in
//      those builders fails here instead of being mirrored by a copy.
// Every op yields to the event loop, so concurrent flows genuinely
// interleave at the points the production code awaits.

type Status = "PENDING" | "SENDING" | "SENT" | "FAILED";

interface Row {
  id: string;
  idempotencyKey: string;
  status: Status;
  html: string | null;
  attempts: number;
  nextAttemptAt: Date | null;
  lockedAt: Date | null;
  lastError: string | null;
  sentAt: Date | null;
  providerId: string | null;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function matches(row: Row, where: Prisma.EmailOutboxWhereInput): boolean {
  for (const [field, cond] of Object.entries(where)) {
    const value = row[field as keyof Row];
    if (typeof cond === "string") {
      if (value !== cond) return false;
      continue;
    }
    if (cond && typeof cond === "object") {
      for (const [op, arg] of Object.entries(cond)) {
        if (op === "startsWith") {
          if (typeof value !== "string" || !value.startsWith(arg as string))
            return false;
        } else if (op === "lte") {
          if (!(value instanceof Date) || value > (arg as Date)) return false;
        } else if (op === "lt") {
          if (typeof value !== "number" || value >= (arg as number))
            return false;
        } else {
          throw new Error(`model does not support ${field}.${op}`);
        }
      }
      continue;
    }
    throw new Error(`model does not support where.${field}`);
  }
  return true;
}

function makeWorld() {
  const rows: Row[] = [];
  const verification = new Map<
    string,
    { tokenHash: string; expiresAt: Date }
  >();
  const reset: { identifier: string; token: string; expires: Date }[] = [];
  const emails = new Map<string, string>([
    ["u1", "u1@example.com"],
    ["u10", "u10@example.com"],
  ]);
  const locks = new Map<string, Promise<unknown>>();
  const held = new Set<string>();
  /** Every cron claim, with the scope's live issuance at that moment. */
  const claims: { claimed: string; live: string | null }[] = [];
  let seq = 0;

  function liveIssuanceId(type: CredentialEmailType, accountId: string) {
    if (type === "email-verification") {
      return verification.get(accountId)?.tokenHash ?? null;
    }
    const t = reset.find((r) => r.identifier === emails.get(accountId));
    return t ? hashCredentialToken(t.token) : null;
  }

  function opsFor(scopeKey: string): CredentialLockedOps {
    const assertHeld = () =>
      assert.ok(held.has(scopeKey), "op used outside its lock");
    return {
      async writeToken(write: CredentialTokenWrite) {
        assertHeld();
        await tick();
        if (write.type === "email-verification") {
          verification.set(write.userId, {
            tokenHash: write.tokenHash,
            expiresAt: write.expiresAt,
          });
          return { id: `evt_${write.userId}` };
        }
        for (let i = reset.length - 1; i >= 0; i--) {
          if (reset[i].identifier === write.identifier) reset.splice(i, 1);
        }
        await tick();
        reset.push({
          identifier: write.identifier,
          token: write.token,
          expires: write.expires,
        });
        return { id: null };
      },
      async isCurrent(issuance, now) {
        assertHeld();
        await tick();
        if (issuance.type === "email-verification") {
          return isVerificationIssuanceCurrent(
            verification.get(issuance.accountId) ?? null,
            issuance,
            now,
          );
        }
        const email = emails.get(issuance.accountId);
        return isResetIssuanceCurrent(
          reset.filter((r) => r.identifier === email),
          issuance,
          now,
        );
      },
      async supersedeRows(where) {
        assertHeld();
        await tick();
        const hit = rows.filter((r) => matches(r, where));
        for (const r of hit) Object.assign(r, SUPERSEDED_FIELDS);
        return hit.length;
      },
      async writeRow(id, write) {
        assertHeld();
        await tick();
        const r = rows.find((x) => x.id === id);
        assert.ok(r);
        Object.assign(r, write);
      },
      async claimRows(where) {
        assertHeld();
        await tick();
        const hit = rows.filter((r) => matches(r, where));
        const now = new Date();
        for (const r of hit) {
          const parsed = parseCredentialEmailKey(r.idempotencyKey);
          assert.ok(parsed);
          claims.push({
            claimed: parsed.issuanceId,
            live: liveIssuanceId(parsed.type, parsed.accountId),
          });
          const fields = CLAIM_FIELDS(now);
          r.status = fields.status;
          r.lockedAt = fields.lockedAt;
          r.attempts += fields.attempts.increment;
        }
        return hit.length;
      },
    };
  }

  const store: CredentialStore = {
    async withLock(scope, fn) {
      const scopeKey = `${scope.type}:${scope.accountId}`;
      const prior = locks.get(scopeKey) ?? Promise.resolve();
      let release!: () => void;
      const mine = new Promise<void>((r) => (release = r));
      locks.set(
        scopeKey,
        prior.then(() => mine),
      );
      await prior;
      held.add(scopeKey);
      try {
        return await fn(opsFor(scopeKey));
      } finally {
        held.delete(scopeKey);
        release();
      }
    },
  };

  /** reserveEmail: a SENDING row, created outside any issuance lock. */
  function reserve(idempotencyKey: string, html = "<a>link</a>"): string {
    const id = `row_${++seq}`;
    rows.push({
      id,
      idempotencyKey,
      status: "SENDING",
      html,
      attempts: 1,
      lockedAt: new Date(),
      nextAttemptAt: null,
      lastError: null,
      sentAt: null,
      providerId: null,
    });
    return id;
  }

  function seed(idempotencyKey: string, status: Status): Row {
    const row: Row = {
      id: `row_${++seq}`,
      idempotencyKey,
      status,
      html: status === "SENT" ? null : "<p>body</p>",
      attempts: 1,
      lockedAt: status === "SENDING" ? new Date() : null,
      nextAttemptAt: status === "PENDING" ? new Date(0) : null,
      lastError: null,
      sentAt: null,
      providerId: null,
    };
    rows.push(row);
    return row;
  }

  const byKey = (key: string) => rows.find((r) => r.idempotencyKey === key)!;

  return {
    store,
    rows,
    reset,
    verification,
    claims,
    reserve,
    seed,
    byKey,
    liveIssuanceId,
  };
}

type World = ReturnType<typeof makeWorld>;

const DAY = 24 * 60 * 60 * 1000;
let tokenSeq = 0;

function writeFor(
  type: CredentialEmailType,
  userId = "u1",
  ttlMs = DAY,
): CredentialTokenWrite {
  const token = `tok${++tokenSeq}`;
  if (type === "email-verification") {
    return {
      type,
      userId,
      tokenHash: hashCredentialToken(token),
      expiresAt: new Date(Date.now() + ttlMs),
    };
  }
  return {
    type,
    userId,
    identifier: `${userId}@example.com`,
    token,
    expires: new Date(Date.now() + ttlMs),
  };
}

const retryableFailure = {
  delivered: false as const,
  error: "provider timeout",
  retryable: true,
};

/** The immediate path: issue → reserve → deliver → finalize. */
async function issueAndFail(world: World, write: CredentialTokenWrite) {
  const { issuance } = await issueCredential(write, world.store);
  const key = credentialEmailKey(issuance);
  const id = world.reserve(key);
  await finalizeReservedEmail(
    { id, idempotencyKey: key, sensitive: true, delivery: retryableFailure },
    world.store,
  );
  return { issuance, key, id };
}

const pendingIn = (
  world: World,
  type: CredentialEmailType,
  accountId: string,
) =>
  world.rows.filter(
    (r) =>
      r.status === "PENDING" &&
      r.idempotencyKey.startsWith(credentialScopePrefix(type, accountId)),
  );

const FLOWS: CredentialEmailType[] = ["email-verification", "password-reset"];

describe("credential email keys", () => {
  it("round-trips an issuance", () => {
    const issuance: CredentialIssuance = {
      type: "password-reset",
      accountId: "u1",
      issuanceId: "abc123",
    };
    const key = credentialEmailKey(issuance);
    assert.equal(key, "credential:password-reset:u1:abc123");
    assert.deepEqual(parseCredentialEmailKey(key), issuance);
  });

  it("an account's prefix does not reach an account whose id extends it", () => {
    const u10 = credentialEmailKey({
      type: "email-verification",
      accountId: "u10",
      issuanceId: "h",
    });
    assert.ok(
      !u10.startsWith(credentialScopePrefix("email-verification", "u1")),
    );
  });

  it("refuses parts containing ':' so a prefix can't straddle accounts", () => {
    assert.throws(() => credentialScopePrefix("password-reset", "u1:x"));
    assert.throws(() =>
      credentialEmailKey({
        type: "password-reset",
        accountId: "u1",
        issuanceId: "a:b",
      }),
    );
    assert.throws(() => credentialScopePrefix("password-reset", ""));
  });

  it("does not treat other mail as credential mail", () => {
    for (const key of [
      "one-off:6b0c1f0e-1111-2222-3333-444455556666",
      "email-verification:abc",
      "booking-reminder:b1:24h",
      "credential:marketing:u1:abc",
      "credential:password-reset:u1",
      "credential:password-reset:u1:abc:extra",
    ]) {
      assert.equal(parseCredentialEmailKey(key), null, key);
    }
  });
});

for (const type of FLOWS) {
  describe(`${type}: newest issuance is the only queued retry`, () => {
    it("a resend cancels the earlier link's queued retry and scrubs it", async () => {
      const world = makeWorld();
      const first = await issueAndFail(world, writeFor(type));
      assert.equal(world.byKey(first.key).status, "PENDING");

      const { superseded } = await issueCredential(writeFor(type), world.store);

      assert.equal(superseded, 1);
      const old = world.byKey(first.key);
      assert.equal(old.status, "FAILED");
      assert.equal(old.lastError, SUPERSEDED_ERROR);
      assert.equal(old.html, null);
      assert.equal(old.nextAttemptAt, null);
    });

    it("the newest link's own failed attempt is still queued", async () => {
      const world = makeWorld();
      await issueAndFail(world, writeFor(type));
      const second = await issueAndFail(world, writeFor(type));

      const pending = pendingIn(world, type, "u1");
      assert.deepEqual(
        pending.map((r) => r.idempotencyKey),
        [second.key],
      );
      assert.ok(pending[0].html, "a queued retry keeps the body it needs");
    });

    it("cancels nothing outside this credential type and account", async () => {
      const world = makeWorld();
      const other: CredentialEmailType =
        type === "email-verification" ? "password-reset" : "email-verification";
      const own = (status: Status, id: string) =>
        world.seed(
          credentialEmailKey({ type, accountId: "u1", issuanceId: id }),
          status,
        );

      const stale = own("PENDING", "old");
      const inFlight = own("SENDING", "inflight");
      const sent = own("SENT", "sent");
      const untouched = [
        inFlight,
        sent,
        world.seed(
          credentialEmailKey({ type, accountId: "u10", issuanceId: "x" }),
          "PENDING",
        ),
        world.seed(
          credentialEmailKey({ type: other, accountId: "u1", issuanceId: "y" }),
          "PENDING",
        ),
        world.seed("one-off:11111111-2222-3333-4444-555555555555", "PENDING"),
        world.seed("booking-reminder:b1:24h", "PENDING"),
        world.seed(`${type}:legacyhash`, "PENDING"),
      ];
      const before = untouched.map((r) => ({ ...r }));

      const { superseded } = await issueCredential(writeFor(type), world.store);

      assert.equal(superseded, 1);
      assert.equal(stale.status, "FAILED");
      assert.deepEqual(
        untouched.map((r) => ({ ...r })),
        before,
      );
    });
  });

  describe(`${type}: races between issuances`, () => {
    it("an older attempt failing after a newer issuance does not queue", async () => {
      const world = makeWorld();

      // Older issuance: token written, email reserved, delivery on the wire.
      const older = await issueCredential(writeFor(type), world.store);
      const olderKey = credentialEmailKey(older.issuance);
      const olderId = world.reserve(olderKey);

      // Newer issuance lands meanwhile. It must not touch the in-flight row.
      const newer = await issueCredential(writeFor(type), world.store);
      assert.equal(newer.superseded, 0);
      assert.equal(world.byKey(olderKey).status, "SENDING");

      // The older attempt now fails retryably.
      const settled = await finalizeReservedEmail(
        {
          id: olderId,
          idempotencyKey: olderKey,
          sensitive: true,
          delivery: retryableFailure,
        },
        world.store,
      );

      assert.equal(settled, "superseded");
      const row = world.byKey(olderKey);
      assert.equal(row.status, "FAILED");
      assert.equal(row.lastError, SUPERSEDED_ERROR);
      assert.equal(row.html, null);
      assert.equal(pendingIn(world, type, "u1").length, 0);
    });

    it("an older attempt that did deliver is still recorded SENT", async () => {
      const world = makeWorld();
      const older = await issueCredential(writeFor(type), world.store);
      const key = credentialEmailKey(older.issuance);
      const id = world.reserve(key);
      await issueCredential(writeFor(type), world.store);

      const settled = await finalizeReservedEmail(
        {
          id,
          idempotencyKey: key,
          sensitive: true,
          delivery: { delivered: true, messageId: "msg_1" },
        },
        world.store,
      );

      assert.equal(settled, "written");
      assert.equal(world.byKey(key).status, "SENT");
      assert.equal(world.byKey(key).html, null);
    });

    it("under arbitrary interleavings, no stale link is ever queued or claimed", async () => {
      // Seeded so a failure is reproducible.
      let seed = 0x5eed;
      const rand = (n: number) => {
        seed = (seed * 1103515245 + 12345) % 2 ** 31;
        return seed % n;
      };
      const pause = async () => {
        for (let i = rand(6); i > 0; i--) await tick();
      };

      for (let round = 0; round < 25; round++) {
        const world = makeWorld();

        const flow = async () => {
          await pause();
          const { issuance } = await issueCredential(
            writeFor(type),
            world.store,
          );
          await pause();
          const key = credentialEmailKey(issuance);
          const id = world.reserve(key);
          await pause(); // delivery
          await finalizeReservedEmail(
            {
              id,
              idempotencyKey: key,
              sensitive: true,
              delivery: retryableFailure,
            },
            world.store,
          );
        };

        const cron = async () => {
          for (let pass = 0; pass < 8; pass++) {
            await pause();
            for (const row of pendingIn(world, type, "u1")) {
              const issuance = parseCredentialEmailKey(row.idempotencyKey)!;
              const outcome = await claimCredentialRow(
                { id: row.id, issuance, startedAt: new Date() },
                world.store,
              );
              if (outcome !== "claimed") continue;
              await pause(); // delivery fails again
              await finalizeReservedEmail(
                {
                  id: row.id,
                  idempotencyKey: row.idempotencyKey,
                  sensitive: true,
                  delivery: retryableFailure,
                },
                world.store,
              );
            }
          }
        };

        await Promise.all([flow(), flow(), flow(), flow(), cron(), cron()]);

        const live = world.liveIssuanceId(type, "u1");
        const pending = pendingIn(world, type, "u1");
        assert.ok(
          pending.length <= 1,
          `round ${round}: ${pending.length} queued`,
        );
        for (const row of pending) {
          assert.equal(
            parseCredentialEmailKey(row.idempotencyKey)!.issuanceId,
            live,
            `round ${round}: a queued retry is not the live link`,
          );
        }
        for (const c of world.claims) {
          assert.equal(c.claimed, c.live, `round ${round}: stale link claimed`);
        }
        assert.equal(
          world.rows.filter((r) => r.status === "SENDING").length,
          0,
          `round ${round}: a row was left SENDING`,
        );
      }
    });
  });

  describe(`${type}: the retry cron's claim`, () => {
    it("claims a queued retry whose link is still live", async () => {
      const world = makeWorld();
      const { issuance, key } = await issueAndFail(world, writeFor(type));
      world.byKey(key).nextAttemptAt = new Date(0);

      const outcome = await claimCredentialRow(
        { id: world.byKey(key).id, issuance, startedAt: new Date() },
        world.store,
      );

      assert.equal(outcome, "claimed");
      assert.equal(world.byKey(key).status, "SENDING");
      assert.equal(world.byKey(key).attempts, 2);
    });

    it("supersedes a stale row that crash recovery put back in PENDING", async () => {
      const world = makeWorld();
      const older = await issueCredential(writeFor(type), world.store);
      const key = credentialEmailKey(older.issuance);
      const id = world.reserve(key);
      // The sender died mid-attempt; a newer link is issued; the stale-lock
      // sweep returns the old row to PENDING without any currency check.
      await issueCredential(writeFor(type), world.store);
      Object.assign(world.byKey(key), {
        status: "PENDING",
        lockedAt: null,
        nextAttemptAt: new Date(0),
      });

      const outcome = await claimCredentialRow(
        { id, issuance: older.issuance, startedAt: new Date() },
        world.store,
      );

      assert.equal(outcome, "superseded");
      assert.equal(world.byKey(key).status, "FAILED");
      assert.equal(world.byKey(key).html, null);
      assert.equal(world.claims.length, 0);
    });

    it("supersedes a queued link that has expired", async () => {
      const world = makeWorld();
      const { issuance, key } = await issueAndFail(
        world,
        writeFor(type, "u1", 60_000),
      );
      world.byKey(key).nextAttemptAt = new Date(0);

      const outcome = await claimCredentialRow(
        {
          id: world.byKey(key).id,
          issuance,
          startedAt: new Date(Date.now() + 2 * 60_000),
        },
        world.store,
      );

      assert.equal(outcome, "superseded");
      assert.equal(world.byKey(key).lastError, SUPERSEDED_ERROR);
    });

    it("skips a row another run already claimed", async () => {
      const world = makeWorld();
      const { issuance, key } = await issueAndFail(world, writeFor(type));
      world.byKey(key).status = "SENDING";

      const outcome = await claimCredentialRow(
        { id: world.byKey(key).id, issuance, startedAt: new Date() },
        world.store,
      );

      assert.equal(outcome, "skipped");
      assert.equal(world.byKey(key).status, "SENDING");
    });
  });
}

describe("a used password-reset link stops its queued retry", () => {
  it("consuming the token makes the queued email stale", async () => {
    const world = makeWorld();
    const { issuance, key } = await issueAndFail(
      world,
      writeFor("password-reset"),
    );
    world.byKey(key).nextAttemptAt = new Date(0);
    world.reset.splice(0); // reset-password route deletes the token

    const outcome = await claimCredentialRow(
      { id: world.byKey(key).id, issuance, startedAt: new Date() },
      world.store,
    );
    assert.equal(outcome, "superseded");
  });
});

describe("sendPasswordResetEmail", () => {
  type SendArgs = SendEmailInput;

  it("keys the email to this issuance and marks it sensitive", async () => {
    const world = makeWorld();
    const sent: SendArgs[] = [];
    const result = await sendPasswordResetEmail(
      { userId: "u1", email: "u1@example.com" },
      {
        store: world.store,
        send: async (input) => {
          sent.push(input);
          return { success: true, queued: false };
        },
      },
    );

    assert.deepEqual(result, { accepted: true });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].sensitive, true);
    const token = /token=([0-9a-f]+)/.exec(sent[0].html)?.[1];
    assert.ok(token);
    assert.deepEqual(parseCredentialEmailKey(sent[0].idempotencyKey!), {
      type: "password-reset",
      accountId: "u1",
      issuanceId: hashCredentialToken(token),
    });
    assert.ok(!sent[0].idempotencyKey!.includes(token), "raw token in key");
    assert.equal(world.reset.length, 1);
    assert.equal(world.reset[0].token, token);
  });

  it("a second request cancels the first request's queued retry", async () => {
    const world = makeWorld();
    const keys: string[] = [];
    const send = async (input: SendArgs) => {
      keys.push(input.idempotencyKey!);
      world.seed(input.idempotencyKey!, "PENDING");
      return { success: false, queued: true, error: "timeout" };
    };
    await sendPasswordResetEmail(
      { userId: "u1", email: "u1@example.com" },
      { store: world.store, send },
    );
    await sendPasswordResetEmail(
      { userId: "u1", email: "u1@example.com" },
      { store: world.store, send },
    );

    assert.equal(world.byKey(keys[0]).status, "FAILED");
    assert.equal(world.byKey(keys[1]).status, "PENDING");
    assert.equal(world.reset.length, 1, "one live reset token");
  });

  it("concurrent requests leave exactly one live token", async () => {
    const world = makeWorld();
    await Promise.all(
      Array.from({ length: 5 }, () =>
        sendPasswordResetEmail(
          { userId: "u1", email: "u1@example.com" },
          {
            store: world.store,
            send: async () => ({ success: true, queued: false }),
          },
        ),
      ),
    );
    assert.equal(world.reset.length, 1);
  });

  it("never throws, so a failure can't reveal the account exists", async () => {
    const failingStore: CredentialStore = {
      withLock: async () => {
        throw new Error("db down");
      },
    };
    const originalError = console.error;
    console.error = () => {};
    try {
      assert.deepEqual(
        await sendPasswordResetEmail(
          { userId: "u1", email: "u1@example.com" },
          { store: failingStore },
        ),
        { accepted: false },
      );
      assert.deepEqual(
        await sendPasswordResetEmail(
          { userId: "u1", email: "u1@example.com" },
          {
            store: makeWorld().store,
            send: async () => {
              throw new Error("boom");
            },
          },
        ),
        { accepted: false },
      );
    } finally {
      console.error = originalError;
    }
  });
});

// ---------------------------------------------------------------------------
// The guards above only help if the real paths go through them.
// ---------------------------------------------------------------------------
const repoRoot = path.resolve(__dirname, "../../..");
const codeOnly = (rel: string) =>
  readFileSync(path.join(repoRoot, rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");

describe("credential guards are wired into the real paths", () => {
  it("forgot-password issues through the guarded service only", () => {
    const route = codeOnly("src/app/api/auth/forgot-password/route.ts");
    assert.match(route, /await sendPasswordResetEmail\(/);
    assert.doesNotMatch(route, /verificationToken/);
    assert.doesNotMatch(route, /\bsendEmail\(/);
    // One success response, reached whether or not the account exists.
    assert.equal(route.match(/t\("resetLinkSent"\)/g)?.length, 1);
  });

  it("the reset service issues under the lock and sends with a credential key", () => {
    const src = codeOnly("src/services/password-reset.ts");
    assert.match(src, /issueCredential\(/);
    assert.match(src, /idempotencyKey: credentialEmailKey\(issuance\)/);
  });

  it("verification issues under the lock and sends with a credential key", () => {
    const src = codeOnly("src/services/email-verification.ts");
    assert.match(src, /issueCredential\(/);
    assert.match(src, /idempotencyKey: credentialEmailKey\(/);
    assert.doesNotMatch(src, /emailVerificationToken\.upsert/);
  });

  it("the immediate path passes the key so finalize can guard it", () => {
    const src = codeOnly("src/lib/email.ts");
    assert.match(
      src,
      /finalizeReservedEmail\(\{[^}]*idempotencyKey: reservation\.idempotencyKey/,
    );
  });

  it("the retry cron claims and settles credential rows through the guard", () => {
    const src = codeOnly("src/services/email-outbox.ts");
    const start = src.indexOf("export async function processEmailOutbox");
    const body = src.slice(start, src.indexOf("\n}\n", start));
    assert.match(body, /await claimCredentialRow\(/);
    assert.match(body, /await settleCredentialRow\(/);
    assert.match(
      body,
      /if \(!issuance\) \{\s*const claim = await db\.emailOutbox\.updateMany/,
    );
  });
});
