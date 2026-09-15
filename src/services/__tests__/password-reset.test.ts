import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  type CredentialStore,
  RESET_TOKEN_HASH_PREFIX,
  hashCredentialToken,
  isResetIssuanceCurrent,
  resetIssuanceIdOf,
  resetTokenRowData,
  storedResetToken,
} from "@/services/credential-email";
import {
  type PasswordResetCompletionStore,
  RESET_TOKEN_TTL_MS,
  completePasswordReset,
  issuePasswordResetToken,
} from "@/services/password-reset";

// Exercises the real issuePasswordResetToken / completePasswordReset
// against an in-memory VerificationToken table. consume models what the
// Prisma transaction guarantees — the delete of one row succeeds for exactly
// one caller — and every op yields first, so concurrent completions
// genuinely interleave at the points production awaits.

interface TokenRow {
  identifier: string;
  token: string;
  expires: Date;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const EMAIL = "u1@example.com";

function makeWorld() {
  const tokens: TokenRow[] = [];
  const passwords = new Map<string, string>([[EMAIL, "old-hash"]]);
  const passwordWrites: { identifier: string; passwordHash: string }[] = [];
  const lookups: string[] = [];

  const completion: PasswordResetCompletionStore = {
    async find(storedToken) {
      lookups.push(storedToken);
      await tick();
      const row = tokens.find((t) => t.token === storedToken);
      return row ? { ...row } : null;
    },
    async consume({ storedToken, identifier, passwordHash, now }) {
      await tick();
      // Atomic from here: no await between the check and the writes.
      const i = tokens.findIndex(
        (t) =>
          t.token === storedToken &&
          t.identifier === identifier &&
          t.expires.getTime() >= now.getTime(),
      );
      if (i === -1) return false;
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].identifier === identifier) tokens.splice(j, 1);
      }
      passwords.set(identifier, passwordHash);
      passwordWrites.push({ identifier, passwordHash });
      return true;
    },
  };

  // Just enough of the credential store for issuance: the same row builder
  // the Prisma store uses, and the same replace-by-identifier.
  const issuance: CredentialStore = {
    async withLock(_scope, fn) {
      return fn({
        async writeToken(write) {
          assert.equal(write.type, "password-reset");
          if (write.type !== "password-reset") return { id: null };
          for (let j = tokens.length - 1; j >= 0; j--) {
            if (tokens[j].identifier === write.identifier) tokens.splice(j, 1);
          }
          tokens.push(resetTokenRowData(write));
          return { id: null };
        },
        isCurrent: async () => true,
        supersedeRows: async () => 0,
        writeRow: async () => {},
        claimRows: async () => 0,
      });
    },
  };

  return { tokens, passwords, passwordWrites, lookups, completion, issuance };
}

type World = ReturnType<typeof makeWorld>;

const hashPassword = async (plain: string) => {
  await tick();
  return `bcrypt(${plain})`;
};

const complete = (world: World, rawToken: string, password = "NewPass123!") =>
  completePasswordReset(
    { rawToken, password },
    { store: world.completion, hashPassword },
  );

async function issue(world: World) {
  const { rawToken } = await issuePasswordResetToken(
    { userId: "u1", email: EMAIL },
    { store: world.issuance },
  );
  return rawToken;
}

/** A row as the pre-hashing code wrote it: the raw token itself. */
function seedLegacy(world: World, ttlMs = RESET_TOKEN_TTL_MS) {
  const rawToken = "ab".repeat(32);
  world.tokens.push({
    identifier: EMAIL,
    token: rawToken,
    expires: new Date(Date.now() + ttlMs),
  });
  return rawToken;
}

describe("reset token storage", () => {
  it("stores only a prefixed SHA-256 of the raw token", async () => {
    const world = makeWorld();
    const rawToken = await issue(world);

    assert.match(rawToken, /^[0-9a-f]{64}$/);
    assert.equal(world.tokens.length, 1);
    const stored = world.tokens[0].token;
    assert.equal(
      stored,
      `${RESET_TOKEN_HASH_PREFIX}${hashCredentialToken(rawToken)}`,
    );
    assert.ok(!stored.includes(rawToken), "raw token stored");
    assert.equal(world.tokens[0].identifier, EMAIL);
  });

  it("keeps the one-hour expiry", async () => {
    const world = makeWorld();
    const before = Date.now();
    const { rawToken } = await issuePasswordResetToken(
      { userId: "u1", email: EMAIL },
      { store: world.issuance, now: () => before },
    );
    assert.ok(rawToken);
    assert.equal(
      world.tokens[0].expires.getTime(),
      before + RESET_TOKEN_TTL_MS,
    );
  });

  it("the issuance id matches the stored row in both formats", () => {
    const raw = "cd".repeat(32);
    const hash = hashCredentialToken(raw);
    assert.equal(resetIssuanceIdOf(storedResetToken(hash)), hash);
    assert.equal(resetIssuanceIdOf(raw), hash);

    const issuance = {
      type: "password-reset" as const,
      accountId: "u1",
      issuanceId: hash,
    };
    const later = new Date(Date.now() + 60_000);
    const now = new Date();
    assert.ok(
      isResetIssuanceCurrent(
        [{ token: storedResetToken(hash), expires: later }],
        issuance,
        now,
      ),
    );
    assert.ok(
      isResetIssuanceCurrent([{ token: raw, expires: later }], issuance, now),
      "a legacy row keeps its queued email current",
    );
    assert.ok(
      !isResetIssuanceCurrent(
        [{ token: storedResetToken(hash), expires: new Date(0) }],
        issuance,
        now,
      ),
    );
  });
});

describe("completePasswordReset", () => {
  it("a valid link sets the password and consumes the token", async () => {
    const world = makeWorld();
    const rawToken = await issue(world);

    assert.deepEqual(await complete(world, rawToken), { status: "updated" });
    assert.equal(world.passwords.get(EMAIL), "bcrypt(NewPass123!)");
    assert.equal(world.tokens.length, 0);
    // Found by hash on the first lookup; the raw value was never queried.
    assert.deepEqual(world.lookups, [
      storedResetToken(hashCredentialToken(rawToken)),
    ]);
  });

  it("an unknown token is invalid and changes nothing", async () => {
    const world = makeWorld();
    await issue(world);

    for (const bogus of ["", "nope", "ef".repeat(32)]) {
      assert.deepEqual(await complete(world, bogus), { status: "invalid" });
    }
    assert.equal(world.passwords.get(EMAIL), "old-hash");
    assert.equal(world.tokens.length, 1);
  });

  it("an expired token is invalid", async () => {
    const world = makeWorld();
    const rawToken = await issue(world);
    world.tokens[0].expires = new Date(Date.now() - 1);

    assert.deepEqual(await complete(world, rawToken), { status: "invalid" });
    assert.equal(world.passwords.get(EMAIL), "old-hash");
  });

  it("a token that expires while the password is hashed is not consumed", async () => {
    const world = makeWorld();
    const rawToken = await issue(world);

    const result = await completePasswordReset(
      { rawToken, password: "NewPass123!" },
      {
        store: world.completion,
        hashPassword: async (plain) => {
          world.tokens[0].expires = new Date(Date.now() - 1);
          return `bcrypt(${plain})`;
        },
      },
    );
    assert.deepEqual(result, { status: "invalid" });
    assert.equal(world.passwords.get(EMAIL), "old-hash");
  });

  it("a used link cannot be replayed", async () => {
    const world = makeWorld();
    const rawToken = await issue(world);

    assert.deepEqual(await complete(world, rawToken, "First123!"), {
      status: "updated",
    });
    assert.deepEqual(await complete(world, rawToken, "Second123!"), {
      status: "invalid",
    });
    assert.equal(world.passwords.get(EMAIL), "bcrypt(First123!)");
  });

  it("a link superseded by a newer request is invalid", async () => {
    const world = makeWorld();
    const first = await issue(world);
    const second = await issue(world);

    assert.deepEqual(await complete(world, first), { status: "invalid" });
    assert.deepEqual(await complete(world, second), { status: "updated" });
  });

  it("concurrent completions: exactly one wins, the rest are invalid", async () => {
    const world = makeWorld();
    const rawToken = await issue(world);

    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => complete(world, rawToken, `Pw${i}!`)),
    );

    assert.equal(results.filter((r) => r.status === "updated").length, 1);
    assert.equal(results.filter((r) => r.status === "invalid").length, 4);
    assert.equal(world.passwordWrites.length, 1, "password written once");
    assert.equal(world.tokens.length, 0);
  });

  it("the stored value from a database dump does not work as a link", async () => {
    const world = makeWorld();
    const rawToken = await issue(world);
    const stored = world.tokens[0].token;
    const digest = stored.slice(RESET_TOKEN_HASH_PREFIX.length);

    // The bare digest is 64 hex — legacy-shaped — so it reaches the raw
    // lookup, where the prefix keeps it from matching.
    assert.deepEqual(await complete(world, digest), { status: "invalid" });
    assert.deepEqual(await complete(world, stored), { status: "invalid" });
    assert.ok(
      !world.lookups.includes(stored),
      "a prefixed submission was looked up raw",
    );
    assert.equal(world.passwords.get(EMAIL), "old-hash");

    assert.deepEqual(await complete(world, rawToken), { status: "updated" });
  });
});

describe("legacy raw-stored reset links", () => {
  it("a still-valid pre-change link works and is consumed", async () => {
    const world = makeWorld();
    const rawToken = seedLegacy(world);

    assert.deepEqual(await complete(world, rawToken), { status: "updated" });
    assert.equal(world.passwords.get(EMAIL), "bcrypt(NewPass123!)");
    assert.equal(world.tokens.length, 0);
    assert.deepEqual(await complete(world, rawToken), { status: "invalid" });
  });

  it("an expired pre-change link is invalid", async () => {
    const world = makeWorld();
    const rawToken = seedLegacy(world, -1);

    assert.deepEqual(await complete(world, rawToken), { status: "invalid" });
    assert.equal(world.passwords.get(EMAIL), "old-hash");
  });

  it("concurrent completions of a legacy link: exactly one wins", async () => {
    const world = makeWorld();
    const rawToken = seedLegacy(world);

    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => complete(world, rawToken, `Pw${i}!`)),
    );
    assert.equal(results.filter((r) => r.status === "updated").length, 1);
    assert.equal(world.passwordWrites.length, 1);
  });

  it("a new request replaces the legacy link", async () => {
    const world = makeWorld();
    const legacy = seedLegacy(world);
    const fresh = await issue(world);

    assert.deepEqual(await complete(world, legacy), { status: "invalid" });
    assert.deepEqual(await complete(world, fresh), { status: "updated" });
  });

  it("only legacy-shaped submissions are looked up raw", async () => {
    const world = makeWorld();
    world.tokens.push({
      identifier: EMAIL,
      token: "short-legacy",
      expires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    });

    assert.deepEqual(await complete(world, "short-legacy"), {
      status: "invalid",
    });
    assert.ok(!world.lookups.includes("short-legacy"));
  });

  it("using one link kills every other outstanding link for the address", async () => {
    const world = makeWorld();
    const legacy = seedLegacy(world);
    const rawToken = "12".repeat(32);
    world.tokens.push(
      resetTokenRowData({
        type: "password-reset",
        userId: "u1",
        identifier: EMAIL,
        tokenHash: hashCredentialToken(rawToken),
        expires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      }),
    );

    assert.deepEqual(await complete(world, rawToken), { status: "updated" });
    assert.deepEqual(await complete(world, legacy), { status: "invalid" });
  });
});

// ---------------------------------------------------------------------------
// The model above only proves something if production matches it.
// ---------------------------------------------------------------------------
const repoRoot = path.resolve(__dirname, "../../..");
const codeOnly = (rel: string) =>
  readFileSync(path.join(repoRoot, rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");

describe("reset completion is wired into the real paths", () => {
  it("the route completes through the service and never reads tokens itself", () => {
    const route = codeOnly("src/app/api/auth/reset-password/route.ts");
    assert.match(
      route,
      /await completePasswordReset\(\{ rawToken: token, password \}\)/,
    );
    assert.doesNotMatch(route, /verificationToken/);
    assert.equal(route.match(/t\("resetLinkInvalid"\)/g)?.length, 1);
  });

  it("the Prisma consume arbitrates with a filtered deleteMany count", () => {
    const src = codeOnly("src/services/password-reset.ts");
    const start = src.indexOf("prismaPasswordResetCompletionStore");
    const body = src.slice(start, src.indexOf("\n  };\n", start));
    assert.match(
      body,
      /const \{ count \} = await tx\.verificationToken\.deleteMany\(\{\s*where: \{ token: storedToken, identifier, expires: \{ gte: now \} \},?\s*\}\);\s*if \(count !== 1\) return false;/,
    );
    assert.match(body, /db\.\$transaction\(/);
    assert.doesNotMatch(body, /verificationToken\.delete\(/);
  });
});
