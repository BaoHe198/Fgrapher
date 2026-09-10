import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type ThrottleReservationOps,
  type ThrottleReservationStore,
  reserveThrottledEmail,
} from "@/services/email-outbox";

// Exercises the real reserveThrottledEmail() against an in-memory store
// that models the two properties the production store must have:
//   1. withLock serialises callers for the same scopeKey (production: a
//      Postgres advisory xact lock).
//   2. hasRecent + create are one atomic step inside that lock.
// The interleaving is real: withLock awaits, so two reservations started
// together genuinely suspend at the same points the production code does.

interface Row {
  id: string;
  idempotencyKey: string;
  createdAt: Date;
}

function makeStore(now: () => Date) {
  const rows: Row[] = [];
  const locks = new Map<string, Promise<unknown>>();
  let seq = 0;

  const ops: ThrottleReservationOps = {
    async hasRecent(keyPrefix, since) {
      await tick();
      return rows.some(
        (r) => r.idempotencyKey.startsWith(keyPrefix) && r.createdAt > since,
      );
    },
    async create(row) {
      await tick();
      const created = {
        id: `row_${++seq}`,
        idempotencyKey: row.idempotencyKey,
        createdAt: now(),
      };
      rows.push(created);
      return created.id;
    },
  };

  const store: ThrottleReservationStore = {
    async withLock(lockKey, fn) {
      // Chain onto any in-flight holder of this key, exactly as a DB
      // advisory lock would queue contenders.
      const prior = locks.get(lockKey) ?? Promise.resolve();
      let release!: () => void;
      const held = new Promise<void>((r) => (release = r));
      locks.set(
        lockKey,
        prior.then(() => held),
      );
      await prior;
      try {
        return await fn(ops);
      } finally {
        release();
      }
    },
  };

  return { store, rows };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const WINDOW = 15 * 60 * 1000;
const payload = {
  to: "recipient@example.com",
  subject: "New message",
  html: "<p>hi</p>",
};

describe("reserveThrottledEmail", () => {
  it("reserves the first send and suppresses a second inside the window", async () => {
    const base = new Date("2026-09-10T12:00:00.000Z");
    let clock = base;
    const { store, rows } = makeStore(() => clock);

    const first = await reserveThrottledEmail(
      {
        ...payload,
        scopeKey: "new-message:c1:u1",
        windowMs: WINDOW,
        now: base,
      },
      store,
    );
    assert.equal(first.reserved, true);

    // 14 minutes 59 seconds later — still inside the window.
    clock = new Date(base.getTime() + WINDOW - 1000);
    const second = await reserveThrottledEmail(
      {
        ...payload,
        scopeKey: "new-message:c1:u1",
        windowMs: WINDOW,
        now: clock,
      },
      store,
    );
    assert.equal(second.reserved, false);
    assert.equal(rows.length, 1);
  });

  it("reserves again exactly at the window boundary", async () => {
    const base = new Date("2026-09-10T12:00:00.000Z");
    let clock = base;
    const { store, rows } = makeStore(() => clock);

    await reserveThrottledEmail(
      {
        ...payload,
        scopeKey: "new-message:c1:u1",
        windowMs: WINDOW,
        now: base,
      },
      store,
    );

    clock = new Date(base.getTime() + WINDOW);
    const next = await reserveThrottledEmail(
      {
        ...payload,
        scopeKey: "new-message:c1:u1",
        windowMs: WINDOW,
        now: clock,
      },
      store,
    );
    assert.equal(next.reserved, true);
    assert.equal(rows.length, 2);
  });

  it("does not throttle a different conversation or recipient", async () => {
    const base = new Date("2026-09-10T12:00:00.000Z");
    const { store, rows } = makeStore(() => base);

    for (const scopeKey of [
      "new-message:c1:u1",
      "new-message:c2:u1",
      "new-message:c1:u2",
    ]) {
      const r = await reserveThrottledEmail(
        { ...payload, scopeKey, windowMs: WINDOW, now: base },
        store,
      );
      assert.equal(r.reserved, true);
    }
    assert.equal(rows.length, 3);
  });

  it("lets exactly one of two concurrent sends win the same conversation", async () => {
    const base = new Date("2026-09-10T12:00:00.000Z");
    const { store, rows } = makeStore(() => base);

    const [a, b] = await Promise.all([
      reserveThrottledEmail(
        {
          ...payload,
          scopeKey: "new-message:c1:u1",
          windowMs: WINDOW,
          now: base,
        },
        store,
      ),
      reserveThrottledEmail(
        {
          ...payload,
          scopeKey: "new-message:c1:u1",
          windowMs: WINDOW,
          now: base,
        },
        store,
      ),
    ]);

    assert.equal([a.reserved, b.reserved].filter(Boolean).length, 1);
    assert.equal(rows.length, 1);
  });
});
