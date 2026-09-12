import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildMediaVariants } from "@/lib/media-variants";
import type { ModerationScores } from "@/lib/openai-moderation";
import {
  type ContentScanner,
  MockScanner,
  OpenAIModerationScanner,
  verdictFromScores,
} from "@/services/moderation";

// Covers the tier-1 policy only — the decision of what an OpenAI score
// means for us — not the HTTP call, which is lib/openai-moderation.ts's
// job and needs a live key to say anything true. The property that
// matters here is the one the whole two-tier design rests on: nothing is
// ever auto-approved, so the worst case of a wrong answer is extra work
// for a human, never unreviewed content going public.

function scores(partial: ModerationScores["scores"]): ModerationScores {
  // `flagged` is deliberately true throughout: it must NOT be what drives
  // an auto-reject (see AUTO_REJECT_THRESHOLD's comment), so every case
  // below would come out differently if the policy ever started reading it.
  return { flagged: true, scores: partial };
}

describe("verdictFromScores", () => {
  it("defers to a human when the scan could not run", () => {
    assert.deepEqual(verdictFromScores(null), { verdict: "needs_review" });
  });

  it("auto-rejects sexual content above the threshold", () => {
    const result = verdictFromScores(scores({ sexual: 0.97 }));
    assert.equal(result.verdict, "flagged");
    assert.match(result.reason ?? "", /sexual/);
    assert.match(result.reason ?? "", /0\.97/);
  });

  it("auto-rejects graphic violence above the threshold", () => {
    assert.equal(
      verdictFromScores(scores({ "violence/graphic": 0.95 })).verdict,
      "flagged",
    );
  });

  it("defers borderline scores to a human rather than rejecting", () => {
    // 0.89 is squarely in the range OpenAI's own `flagged` boolean would
    // call a violation. We send it to review instead, because an
    // auto-reject costs a violation point and three auto-suspend the
    // account.
    assert.deepEqual(verdictFromScores(scores({ sexual: 0.89 })), {
      verdict: "needs_review",
    });
  });

  it("never auto-rejects on categories reserved for human judgement", () => {
    // self-harm fires on scars and medical/documentary imagery on a
    // photography platform — a human decides, every time.
    assert.deepEqual(
      verdictFromScores(
        scores({ "self-harm": 0.99, "self-harm/intent": 0.99 }),
      ),
      { verdict: "needs_review" },
    );
  });

  it("defers when the expected categories are absent from the response", () => {
    assert.deepEqual(verdictFromScores(scores({})), {
      verdict: "needs_review",
    });
  });

  it("never returns a verdict that approves anything", () => {
    const cases: (ModerationScores | null)[] = [
      null,
      scores({}),
      scores({ sexual: 0 }),
      scores({ sexual: 1 }),
      scores({ "violence/graphic": 0.5 }),
    ];
    for (const input of cases) {
      const { verdict } = verdictFromScores(input);
      assert.ok(
        verdict === "needs_review" || verdict === "flagged",
        `unexpected verdict ${verdict}`,
      );
    }
  });
});

describe("what actually crosses the border", () => {
  const original =
    "https://res.cloudinary.com/demo/image/upload/v1/portfolio/shot.jpg";

  it("sends a 512px derivative, never the uploaded original", () => {
    const { moderation } = buildMediaVariants(original);
    assert.match(moderation, /c_limit,w_512/);
    assert.notEqual(moderation, original);
  });

  it("sends a transformed URL, so no EXIF/GPS rides along", () => {
    // A Cloudinary transformation re-encodes the file; the derivative
    // carries none of the original's metadata. The assertion that matters
    // is simply that we never hand over the untransformed original.
    const { moderation } = buildMediaVariants(original);
    assert.ok(moderation.includes("/upload/c_limit,w_512"));
  });

  it("falls back to the original only when the URL is not Cloudinary's", () => {
    const foreign = "https://example.com/a.jpg";
    assert.equal(buildMediaVariants(foreign).moderation, foreign);
  });
});

describe("OpenAIModerationScanner", () => {
  it("sends videos straight to the human queue without calling the API", async () => {
    // No key is configured in the test environment, so a call that did go
    // out would return null and land on needs_review anyway — the point
    // is that the VIDEO branch returns before attempting it at all.
    const result = await new OpenAIModerationScanner().scan({
      url: "https://res.cloudinary.com/demo/video/upload/sample.mp4",
      publicId: "sample",
      type: "VIDEO",
    });
    assert.deepEqual(result, { verdict: "needs_review" });
  });

  it("defers when the URL is not publicly fetchable", async () => {
    const result = await new OpenAIModerationScanner().scan({
      url: "blob:http://localhost:3000/9f2c",
      publicId: null,
      type: "IMAGE",
    });
    assert.deepEqual(result, { verdict: "needs_review" });
  });
});

describe("MockScanner", () => {
  it("still defers everything, so an unconfigured environment is unchanged", async () => {
    // Through the interface, the way every call site reaches it —
    // MockScanner's own scan() declares no parameters.
    const scanner: ContentScanner = new MockScanner();
    const result = await scanner.scan({
      url: "https://example.com/a.jpg",
      publicId: null,
    });
    assert.deepEqual(result, { verdict: "needs_review" });
  });
});
