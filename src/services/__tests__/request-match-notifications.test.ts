import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, mock } from "node:test";

import type { Prisma } from "@prisma/client";

import {
  NOTIFICATION_POLICY,
  selectInAppRecipients,
  type BatchRecipient,
  type FeatureGate,
} from "@/lib/notifications";
import type { NotificationPreferences } from "@/lib/validations/user";
import {
  NOTIFICATION_BATCH_SIZE,
  NotificationBatchError,
  notifyInAppBatch,
  type InAppBatchWriter,
} from "@/services/notification";
import {
  notifyMatchingProviders,
  type RequestMatchDeps,
} from "@/services/request-offers";

// REQUEST_NEW_MATCH used to be one notify() per matched provider, awaited in
// turn (a preference read + an insert each), launched by the caller as
// `void notifyMatchingProviders(…).catch(() => {})` — on serverless that
// work can be killed once the response is sent, and every error was
// swallowed. These tests pin the replacement: same people notified, a
// bounded number of writes, and failures that are reported rather than
// thrown or hidden.

const coreOnly: FeatureGate = (feature) => feature === "core";

const allOn = { email: true, inApp: true };
const prefsWith = (
  serviceRequests: { email: boolean; inApp: boolean },
  // other toggles default on
): NotificationPreferences =>
  ({ serviceRequests }) as unknown as NotificationPreferences;

const recipient = (
  userId: string,
  prefs: NotificationPreferences | null = null,
): BatchRecipient => ({ userId, prefs });

function recordingWriter(opts: { failOnCall?: number } = {}) {
  const calls: Prisma.NotificationCreateManyInput[][] = [];
  const writer: InAppBatchWriter = {
    async createMany(rows) {
      calls.push(rows);
      if (opts.failOnCall === calls.length) throw new Error("db down");
      return { count: rows.length };
    },
  };
  return { writer, calls };
}

const request = {
  id: "req_1",
  code: "YC-0001",
  title: "Chụp ảnh cưới",
  customerId: "customer_1",
  role: "PHOTOGRAPHER",
  provinceId: "prov_hcm",
  shootDate: null,
  isDateFlexible: true,
} as const;

const fixedText: RequestMatchDeps["composeText"] = async () => ({
  title: "Yêu cầu mới phù hợp",
  message: "Chụp ảnh cưới (YC-0001)",
});

// ---------------------------------------------------------------------------
describe("preference gating — the same people notify() would reach", () => {
  it("REQUEST_NEW_MATCH is in-app only and governed by serviceRequests", () => {
    const entry = NOTIFICATION_POLICY.REQUEST_NEW_MATCH;
    assert.equal(entry.email, "none");
    assert.equal(entry.inApp, true);
    assert.equal(entry.preferenceKey, "serviceRequests");
  });

  it("includes recipients who never set preferences (defaults are on)", () => {
    assert.deepEqual(
      selectInAppRecipients({
        type: "REQUEST_NEW_MATCH",
        recipients: [recipient("a"), recipient("b")],
        isFeatureEnabled: coreOnly,
      }),
      ["a", "b"],
    );
  });

  it("excludes a recipient who turned serviceRequests in-app off", () => {
    assert.deepEqual(
      selectInAppRecipients({
        type: "REQUEST_NEW_MATCH",
        recipients: [
          recipient("on", prefsWith(allOn)),
          recipient("off", prefsWith({ email: true, inApp: false })),
        ],
        isFeatureEnabled: coreOnly,
      }),
      ["on"],
    );
  });

  it("ignores the email toggle — only in-app decides this broadcast", () => {
    assert.deepEqual(
      selectInAppRecipients({
        type: "REQUEST_NEW_MATCH",
        recipients: [recipient("x", prefsWith({ email: false, inApp: true }))],
        isFeatureEnabled: coreOnly,
      }),
      ["x"],
    );
  });

  it("consults the feature gate — a disabled feature notifies nobody", () => {
    assert.deepEqual(
      selectInAppRecipients({
        type: "REQUEST_NEW_MATCH",
        recipients: [recipient("a"), recipient("b")],
        isFeatureEnabled: () => false,
      }),
      [],
    );
  });

  it("refuses types that email, so the batch path can never drop an email", () => {
    assert.throws(
      () =>
        selectInAppRecipients({
          type: "REQUEST_NEW_OFFER",
          recipients: [recipient("a")],
          isFeatureEnabled: coreOnly,
        }),
      /email policy/,
    );
  });

  it("never notifies the same person twice", () => {
    assert.deepEqual(
      selectInAppRecipients({
        type: "REQUEST_NEW_MATCH",
        recipients: [recipient("a"), recipient("a"), recipient("b")],
        isFeatureEnabled: coreOnly,
      }),
      ["a", "b"],
    );
  });
});

// ---------------------------------------------------------------------------
describe("batched delivery — no per-recipient reads or writes", () => {
  it("writes every eligible recipient in one createMany", async () => {
    const { writer, calls } = recordingWriter();
    const result = await notifyInAppBatch(
      {
        type: "REQUEST_NEW_MATCH",
        recipients: [
          recipient("a"),
          recipient("b", prefsWith({ email: true, inApp: false })),
          recipient("c"),
        ],
        title: "T",
        message: "M",
        data: { requestId: "req_1" },
      },
      writer,
    );

    assert.equal(calls.length, 1, "expected exactly one createMany");
    assert.deepEqual(
      calls[0].map((row) => row.userId),
      ["a", "c"],
    );
    for (const row of calls[0]) {
      assert.equal(row.type, "REQUEST_NEW_MATCH");
      assert.equal(row.title, "T");
      assert.equal(row.message, "M");
      assert.deepEqual(row.data, { requestId: "req_1" });
    }
    assert.deepEqual(result, { eligible: 2, created: 2 });
  });

  it("does not write at all when nobody is eligible", async () => {
    const { writer, calls } = recordingWriter();
    const result = await notifyInAppBatch(
      {
        type: "REQUEST_NEW_MATCH",
        recipients: [recipient("a", prefsWith({ email: true, inApp: false }))],
        title: "T",
        message: "M",
      },
      writer,
    );
    assert.equal(calls.length, 0);
    assert.deepEqual(result, { eligible: 0, created: 0 });
  });

  it("chunks very large broadcasts instead of one write per recipient", async () => {
    const total = NOTIFICATION_BATCH_SIZE * 2 + 1;
    const { writer, calls } = recordingWriter();
    const result = await notifyInAppBatch(
      {
        type: "REQUEST_NEW_MATCH",
        recipients: Array.from({ length: total }, (_, i) => recipient(`u${i}`)),
        title: "T",
        message: "M",
      },
      writer,
    );
    assert.deepEqual(
      calls.map((rows) => rows.length),
      [NOTIFICATION_BATCH_SIZE, NOTIFICATION_BATCH_SIZE, 1],
    );
    assert.equal(result.created, total);
  });

  it("finds recipients once and composes the text once for everyone", async () => {
    const { writer, calls } = recordingWriter();
    const findRecipients = mock.fn(async () => [
      recipient("a"),
      recipient("b"),
      recipient("c"),
    ]);
    const composeText = mock.fn(fixedText);
    const report = mock.fn();

    const outcome = await notifyMatchingProviders(request, {
      findRecipients,
      composeText,
      writeInApp: (input) => notifyInAppBatch(input, writer),
      report,
    });

    assert.deepEqual(outcome, { status: "delivered", matched: 3, created: 3 });
    assert.equal(findRecipients.mock.callCount(), 1);
    assert.equal(composeText.mock.callCount(), 1);
    assert.equal(calls.length, 1, "one createMany for all three providers");
    assert.equal(report.mock.callCount(), 0);
  });

  it("with no matching providers, neither composes nor writes", async () => {
    const composeText = mock.fn(fixedText);
    const writeInApp = mock.fn(notifyInAppBatch);
    const outcome = await notifyMatchingProviders(request, {
      findRecipients: async () => [],
      composeText,
      writeInApp,
    });
    assert.deepEqual(outcome, { status: "delivered", matched: 0, created: 0 });
    assert.equal(composeText.mock.callCount(), 0);
    assert.equal(writeInApp.mock.callCount(), 0);
  });
});

// ---------------------------------------------------------------------------
describe("error handling — never rejects, always reported", () => {
  it("a failed candidate lookup resolves as failed at the match stage", async () => {
    const report = mock.fn();
    const outcome = await notifyMatchingProviders(request, {
      findRecipients: async () => {
        throw new Error("query timeout");
      },
      report,
    });
    assert.equal(outcome.status, "failed");
    assert.equal(outcome.status === "failed" && outcome.stage, "match");
    assert.equal(outcome.status === "failed" && outcome.created, 0);
    assert.equal(report.mock.callCount(), 1);
    assert.deepEqual(report.mock.calls[0].arguments, [request, outcome]);
  });

  it("a failed text lookup resolves as failed at the compose stage", async () => {
    const report = mock.fn();
    const outcome = await notifyMatchingProviders(request, {
      findRecipients: async () => [recipient("a")],
      composeText: async () => {
        throw new Error("missing message key");
      },
      report,
    });
    assert.equal(outcome.status === "failed" && outcome.stage, "compose");
    assert.equal(report.mock.callCount(), 1);
  });

  it("a write failing part-way reports how many rows were already stored", async () => {
    const { writer } = recordingWriter({ failOnCall: 2 });
    const report = mock.fn();
    const outcome = await notifyMatchingProviders(request, {
      findRecipients: async () =>
        Array.from({ length: NOTIFICATION_BATCH_SIZE + 5 }, (_, i) =>
          recipient(`u${i}`),
        ),
      composeText: fixedText,
      writeInApp: (input) => notifyInAppBatch(input, writer),
      report,
    });
    assert.equal(outcome.status, "failed");
    if (outcome.status !== "failed") return;
    assert.equal(outcome.stage, "write");
    assert.equal(outcome.created, NOTIFICATION_BATCH_SIZE);
    assert.ok(outcome.error instanceof NotificationBatchError);
    assert.equal(report.mock.callCount(), 1);
  });

  it("a throwing reporter still cannot make it reject", async () => {
    const outcome = await notifyMatchingProviders(request, {
      findRecipients: async () => {
        throw new Error("boom");
      },
      report: () => {
        throw new Error("reporter broke too");
      },
    });
    assert.equal(outcome.status, "failed");
  });

  it("the real reporter makes the failure visible in the logs", async (t) => {
    const logged = t.mock.method(console, "error", () => {});
    const outcome = await notifyMatchingProviders(request, {
      findRecipients: async () => {
        throw new Error("query timeout");
      },
    });
    assert.equal(outcome.status, "failed");
    assert.equal(logged.mock.callCount(), 1);
    const [tag, details] = logged.mock.calls[0].arguments as [
      string,
      Record<string, unknown>,
    ];
    assert.match(tag, /\[Service Request\]/);
    assert.equal(details.requestId, "req_1");
    assert.equal(details.stage, "match");
    assert.ok(details.error instanceof Error);
  });
});

// ---------------------------------------------------------------------------
// Wiring guards: the callers must await delivery rather than detach it, and
// the broadcast must not drift back to one notify() per provider.
// ---------------------------------------------------------------------------
const repoRoot = path.resolve(__dirname, "../../..");
const codeOnly = (rel: string) =>
  readFileSync(path.join(repoRoot, rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");

describe("approval controls when matching providers are notified", () => {
  const callers = codeOnly("src/services/service-requests.ts");

  it("notifies exactly once, after admin approval", () => {
    const awaited = callers.match(/await notifyMatchingProviders\(/g) ?? [];
    assert.equal(awaited.length, 1);

    const createStart = callers.indexOf(
      "export async function createServiceRequest",
    );
    const publishStart = callers.indexOf(
      "export async function publishDraftServiceRequest",
    );
    const reviewStart = callers.indexOf(
      "export async function reviewServiceRequest",
    );
    const listStart = callers.indexOf(
      "export async function listCustomerRequests",
    );

    assert.doesNotMatch(
      callers.slice(createStart, publishStart),
      /notifyMatchingProviders\(/,
    );
    assert.doesNotMatch(
      callers.slice(publishStart, reviewStart),
      /notifyMatchingProviders\(/,
    );
    assert.match(
      callers.slice(reviewStart, listStart),
      /await notifyMatchingProviders\(/,
    );
  });

  it("no caller detaches it or swallows its errors", () => {
    assert.doesNotMatch(callers, /void notifyMatchingProviders/);
    assert.doesNotMatch(
      callers,
      /notifyMatchingProviders\([^)]*\)\s*\.catch\(/,
    );
  });

  it("the broadcast no longer calls notify() per provider", () => {
    const src = codeOnly("src/services/request-offers.ts");
    const start = src.indexOf("export async function notifyMatchingProviders");
    const body = src.slice(start, src.indexOf("\n}\n", start));
    assert.doesNotMatch(body, /\bnotify\(/);
    assert.doesNotMatch(body, /for \(const /);
  });
});
