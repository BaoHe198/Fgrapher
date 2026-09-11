# Polling

There is no realtime transport in this app (no Pusher/Socket.io — see
CLAUDE.md). Messages, conversation lists, unread badges and the notification
bell all refresh on a timer. This is the policy those timers follow and what it
costs.

## The rule

Every interval-driven refresh goes through `usePolling`
(`src/hooks/use-polling.ts`). Nothing calls `setInterval` directly; a test
guards that (`src/hooks/__tests__/polling-policy.test.ts`).

The decisions live in `src/hooks/polling-policy.ts`, kept pure and
dependency-free so they can be unit-tested without a DOM — same split as
`services/email-outbox-policy.ts`. The hook is only the wiring.

| Rule                                                   | Function               | Why                                                                                                                     |
| ------------------------------------------------------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Stop while the tab is hidden                           | `canPoll`              | Nobody is looking. A backgrounded tab costs nothing.                                                                    |
| Never run two requests for the same data at once       | `canPoll` (`inFlight`) | The next run is scheduled after the previous **settles**, not on a fixed grid, so responses cannot arrive out of order. |
| Refresh the moment the tab comes back                  | `shouldCatchUp`        | Waiting out an interval would show data frozen since the user left — possibly hours.                                    |
| Drop a response overtaken by a newer request           | `isFreshResponse`      | Scheduled runs never overlap, but a manual refresh (send, conversation switch) can race one.                            |
| Only PATCH `/read` when something is unread **for us** | `shouldMarkRead`       | It is a two-row write. See below.                                                                                       |

Options: `enabled` pauses a poller entirely (panel closed/minimized);
`resetKey` restarts it and fetches immediately (a new conversation id);
`skipInitialRun` skips only the first fetch, for callers whose data already
arrived with the server-rendered page.

**One consequence worth knowing:** because the interval is measured from when
the previous response settles, the effective rate is `interval + latency`. A
"2s" chat poll is ~2.2s against a fast server and ~4s against a slow one. That
is the price of never overlapping, and it is the right trade — the old fixed
grid simply stacked requests when the server was slow.

## What was wrong before

- **The messaging popup rendered its body twice.** Desktop and mobile were two
  sibling trees, each rendering the same `{body}`, with CSS hiding whichever
  did not apply. CSS hides; it does not unmount — so an open conversation
  mounted **two** `ChatPanel`s and doubled every poll. Minimizing did not help:
  the desktop branch dropped the body, the mobile one kept rendering it behind
  `sm:hidden`.
- **`PATCH /read` fired after every single load** — every 2 seconds for as long
  as a conversation stayed open, almost always writing nothing. Each call is
  `$transaction([conversationParticipant.update, message.updateMany])`, two
  row-writes.
- **Everything kept polling in hidden tabs**, including the 2s chat loop.
- **The bell fetched a whole page to render one integer.**
  `GET /api/notifications?page=1` is `findMany` + two `count`s — three queries
  — and while the dropdown is closed only `unreadCount` is read.
  `?countOnly=true` now answers with a single `count`.

## Measured

Chromium via Playwright against the dev server, signed in as a seed account on
`/dashboard/messages` with a conversation open, counting same-origin `/api/*`
requests over a 20-second window. Identical script and conversation on both
sides; "before" is the same tree with the change stashed.

| 20s window                             | Before                 | After |
| -------------------------------------- | ---------------------- | ----- |
| **Tab visible**, conversation open     | **22**                 | **8** |
| — `…/messages`                         | 10                     | 5     |
| — `…/read` (2 row-writes each)         | **10**                 | **1** |
| — `/api/conversations`                 | 1                      | 1     |
| — `/api/conversations/unread-count`    | 1                      | 1     |
| **Tab hidden**, same page              | **25**                 | **0** |
| — `…/read` in a tab nobody is watching | 11 (**22 row-writes**) | 0     |

On resume the after-state refetches conversations, messages, the unread count
and the notification count within ~1s, rather than waiting out its 15/20/30s
intervals — the before-state only refetched messages.

Caveats, stated plainly:

- The visible-tab `…/messages` drop (10 → 5) is partly the dev server's
  latency showing up in `interval + latency`. On a fast server that gap
  narrows. The **hidden-tab** drop (25 → 0) and the **`/read`** drop (10 → 1,
  11 → 0) are structural and do not depend on latency.
- These are request counts, not server CPU. The `/read` and bell numbers
  translate directly into database operations (2 writes per `/read`; 3 queries
  → 1 for a closed bell); the rest are one query each.
- Measured on dev data (a handful of conversations). Request _counts_ per
  client do not change with data volume; per-request cost does.

## Adding a poller

```ts
usePolling(load, { intervalMs: 15_000, enabled: isPanelOpen });
```

Pass `enabled` for anything that can be closed, minimized or otherwise not on
screen — the visibility gate only knows about the browser tab, not about your
component being behind a collapsed panel. If the data is already on screen from
SSR, add `skipInitialRun: true`.
