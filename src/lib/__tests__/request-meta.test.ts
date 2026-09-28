import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getClientIp } from "@/lib/rate-limit";
import { getRequestIp, getRequestMeta } from "@/lib/request-meta";

const req = (headers: Record<string, string>) =>
  new Request("http://localhost/", { headers });

// The five routes that record consent / audit evidence used to parse the
// header inline; these pin the exact behaviour they had.
describe("request meta", () => {
  it("takes the first hop of a proxy chain, trimmed", () => {
    assert.equal(
      getRequestIp(req({ "x-forwarded-for": " 203.0.113.7 , 10.0.0.1" })),
      "203.0.113.7",
    );
  });

  it("is undefined without the header, where rate limiting says unknown", () => {
    assert.equal(getRequestIp(req({})), undefined);
    assert.equal(getClientIp(req({})), "unknown");
  });

  it("returns the user agent, or undefined", () => {
    assert.deepEqual(
      getRequestMeta(
        req({ "x-forwarded-for": "198.51.100.9", "user-agent": "QA/1" }),
      ),
      { ipAddress: "198.51.100.9", userAgent: "QA/1" },
    );
    assert.deepEqual(getRequestMeta(req({})), {
      ipAddress: undefined,
      userAgent: undefined,
    });
  });
});
