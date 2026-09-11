import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  canPoll,
  isFreshResponse,
  shouldCatchUp,
  shouldMarkRead,
  type PollGate,
} from "@/hooks/polling-policy";

const repoRoot = path.resolve(__dirname, "../../..");
const read = (rel: string) => readFileSync(path.join(repoRoot, rel), "utf8");

// Comments explain the bug being guarded against and naturally quote the very
// strings these assertions look for. Strip them so prose can't satisfy — or
// break — a check about real code.
const codeOnly = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");

const gate = (over: Partial<PollGate> = {}): PollGate => ({
  enabled: true,
  visible: true,
  inFlight: false,
  ...over,
});

describe("canPoll — the three reasons a poll must not start", () => {
  it("polls when wanted, visible, and nothing outstanding", () => {
    assert.equal(canPoll(gate()), true);
  });

  it("does not poll a disabled poller (panel closed / minimized)", () => {
    assert.equal(canPoll(gate({ enabled: false })), false);
  });

  it("does not poll while the tab is hidden — nobody is looking", () => {
    assert.equal(canPoll(gate({ visible: false })), false);
  });

  it("does not start a second request while one is still outstanding", () => {
    // This is what makes the schedule non-overlapping, and therefore what
    // stops a slow response landing after a newer one.
    assert.equal(canPoll(gate({ inFlight: true })), false);
  });
});

describe("shouldCatchUp — refresh on resume, not on the next tick", () => {
  it("catches up when the tab comes back", () => {
    assert.equal(
      shouldCatchUp(gate({ visible: false }), gate({ visible: true })),
      true,
    );
  });

  it("catches up when the poller is switched on", () => {
    assert.equal(
      shouldCatchUp(gate({ enabled: false }), gate({ enabled: true })),
      true,
    );
  });

  it("does not catch up when it was already running", () => {
    assert.equal(shouldCatchUp(gate(), gate()), false);
  });

  it("does not catch up on the way OUT of pollable", () => {
    assert.equal(
      shouldCatchUp(gate({ visible: true }), gate({ visible: false })),
      false,
    );
  });

  it("stays paused when only one of the two conditions returns", () => {
    // Tab visible again but the panel is still closed — still nothing to do.
    assert.equal(
      shouldCatchUp(
        gate({ enabled: false, visible: false }),
        gate({ enabled: false, visible: true }),
      ),
      false,
    );
  });
});

describe("isFreshResponse — a stale answer never wins", () => {
  it("accepts the response to the newest request", () => {
    assert.equal(isFreshResponse(5, 5), true);
  });

  it("drops a response overtaken by a later request", () => {
    // Request 4 was still in flight when a manual refresh fired request 5.
    assert.equal(isFreshResponse(4, 5), false);
  });
});

describe("shouldMarkRead — the two-row write only when it does something", () => {
  const me = "user_me";
  const them = "user_them";

  it("marks read when the other side has an unread message", () => {
    assert.equal(shouldMarkRead([{ senderId: them, readAt: null }], me), true);
  });

  it("does not mark read for our own unread-by-them messages", () => {
    // `readAt: null` on OUR message means THEY have not read it. Writing
    // here is what fired every 2s and wrote nothing.
    assert.equal(shouldMarkRead([{ senderId: me, readAt: null }], me), false);
  });

  it("does not mark read when their messages are already read", () => {
    assert.equal(
      shouldMarkRead([{ senderId: them, readAt: "2026-09-11T10:00:00Z" }], me),
      false,
    );
  });

  it("does not mark read on an empty conversation", () => {
    assert.equal(shouldMarkRead([], me), false);
  });

  it("finds one unread among many read messages", () => {
    const messages = [
      { senderId: me, readAt: null },
      { senderId: them, readAt: "2026-09-11T10:00:00Z" },
      { senderId: me, readAt: "2026-09-11T10:01:00Z" },
      { senderId: them, readAt: null },
    ];
    assert.equal(shouldMarkRead(messages, me), true);
  });

  it("settles back to false once the PATCH has landed", () => {
    // The next poll returns those same messages with readAt set, so the
    // panel stops asking rather than re-writing on every tick.
    const afterPatch = [{ senderId: them, readAt: "2026-09-11T10:02:00Z" }];
    assert.equal(shouldMarkRead(afterPatch, me), false);
  });
});

// -----------------------------------------------------------------------------
// Wiring guards. These read the real components and fail if a poller goes back
// to a bare interval, if the popup regrows a second body, or if the chat panel
// starts marking read unconditionally again.
// -----------------------------------------------------------------------------

describe("no component keeps its own polling loop", () => {
  const polled = [
    "src/components/chat/chat-panel.tsx",
    "src/components/messaging/messaging-popup.tsx",
    "src/components/providers/messaging-provider.tsx",
    "src/components/layout/notification-bell.tsx",
    "src/app/(dashboard)/dashboard/messages/messages-client.tsx",
  ];

  for (const file of polled) {
    it(`${file} polls through usePolling, not setInterval`, () => {
      const src = codeOnly(read(file));
      assert.match(src, /usePolling\(/);
      assert.doesNotMatch(
        src,
        /setInterval\(/,
        `${file} went back to a bare interval — it would poll hidden tabs and overlap requests`,
      );
    });
  }
});

describe("the messaging popup mounts exactly one body", () => {
  const src = codeOnly(read("src/components/messaging/messaging-popup.tsx"));

  it("renders {body} once", () => {
    // Two sibling trees each rendering {body}, one hidden with CSS, mounted
    // two ChatPanels and doubled every poll — CSS hides, it does not unmount.
    const rendered = src.match(/\{body\}/g) ?? [];
    assert.equal(
      rendered.length,
      1,
      `expected exactly 1 {body} render site, found ${rendered.length}`,
    );
  });

  it("has no sm:hidden / hidden-sm:flex twin containers left", () => {
    assert.doesNotMatch(src, /sm:hidden/);
    assert.doesNotMatch(src, /hidden[^"]*sm:flex/);
  });

  it("stops polling conversations while closed or minimized", () => {
    assert.match(src, /enabled:\s*isOpen && !isMinimized/);
  });
});

describe("chat panel read-marking and freshness", () => {
  const src = codeOnly(read("src/components/chat/chat-panel.tsx"));

  it("guards the read PATCH behind shouldMarkRead", () => {
    assert.match(src, /if \(shouldMarkRead\([\s\S]{0,60}\)\) \{/);
    // and the PATCH appears only inside that guard
    const patches = src.match(/\/read`, \{ method: "PATCH" \}/g) ?? [];
    assert.equal(patches.length, 1);
  });

  it("drops responses overtaken by a newer request", () => {
    assert.match(src, /isFreshResponse\(seq, latestSeqRef\.current\)/);
  });
});

describe("the notification bell stays cheap while closed", () => {
  const bell = codeOnly(read("src/components/layout/notification-bell.tsx"));

  it("polls a count-only read when the dropdown is shut", () => {
    assert.match(bell, /countOnly=true/);
    assert.match(bell, /usePolling\(isOpen \? load : loadCount/);
  });

  it("has a count-only server path that is one query, not three", () => {
    const route = read("src/app/api/notifications/route.ts");
    assert.match(route, /countOnly.*===\s*"true"/);
    assert.match(route, /countUnreadNotifications/);

    const service = read("src/services/notification.ts");
    const fn = service.slice(
      service.indexOf("export async function countUnreadNotifications"),
    );
    const body = fn.slice(0, fn.indexOf("\n}\n"));
    const queries = body.match(/db\.notification\./g) ?? [];
    assert.equal(
      queries.length,
      1,
      `count-only read should touch the database once, found ${queries.length}`,
    );
  });
});
