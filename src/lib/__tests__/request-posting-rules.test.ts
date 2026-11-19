import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { offerDisplayStatus } from "@/lib/request-offer-status";
import {
  createServiceRequestSchema,
  requestDateProblem,
} from "@/lib/validations/service-request";

const TODAY = "2026-11-19";

describe("when an F Booking request may be posted", () => {
  it("needs a date unless the date is flexible", () => {
    assert.equal(requestDateProblem({}, TODAY), "missing");
    assert.equal(requestDateProblem({ isDateFlexible: true }, TODAY), null);
    assert.equal(requestDateProblem({ shootDate: TODAY }, TODAY), null);
  });

  it("refuses a date that has passed, but not today", () => {
    assert.equal(
      requestDateProblem({ shootDate: "2026-11-18" }, TODAY),
      "past",
    );
    assert.equal(requestDateProblem({ shootDate: "2026-11-19" }, TODAY), null);
    assert.equal(requestDateProblem({ shootDate: "2026-12-01" }, TODAY), null);
  });

  it("judges a flexible request by the end of its window", () => {
    // "± 3 ngày" around a date two days ago is still usable tomorrow.
    assert.equal(
      requestDateProblem(
        {
          isDateFlexible: true,
          shootDate: "2026-11-17",
          dateRangeEnd: "2026-11-20",
        },
        TODAY,
      ),
      null,
    );
    assert.equal(
      requestDateProblem(
        {
          isDateFlexible: true,
          shootDate: "2026-11-10",
          dateRangeEnd: "2026-11-13",
        },
        TODAY,
      ),
      "past",
    );
  });

  const base = {
    title: "Chụp ảnh cưới",
    role: "PHOTOGRAPHER",
    provinceId: "province",
  };

  it("lets a draft be saved with no date or a stale one", () => {
    assert.ok(
      createServiceRequestSchema.safeParse({ ...base, isDraft: true }).success,
    );
    assert.ok(
      createServiceRequestSchema.safeParse({
        ...base,
        isDraft: true,
        shootDate: "2020-01-01",
      }).success,
    );
  });

  it("does not let a request for a past day reach review", () => {
    const parsed = createServiceRequestSchema.safeParse({
      ...base,
      shootDate: "2020-01-01",
    });
    assert.equal(parsed.success, false);
    assert.deepEqual(parsed.error?.issues[0]?.path, ["shootDate"]);
  });
});

describe("how an offer's state reads once its request has closed", () => {
  it("names the request's fate instead of a refusal nobody made", () => {
    assert.equal(
      offerDisplayStatus("DECLINED", "CANCELLED"),
      "REQUEST_CANCELLED",
    );
    assert.equal(offerDisplayStatus("DECLINED", "EXPIRED"), "REQUEST_EXPIRED");
  });

  it("leaves every other combination as stored", () => {
    assert.equal(offerDisplayStatus("DECLINED", "FULFILLED"), "DECLINED");
    assert.equal(offerDisplayStatus("DECLINED", "OPEN"), "DECLINED");
    assert.equal(offerDisplayStatus("WITHDRAWN", "CANCELLED"), "WITHDRAWN");
    assert.equal(offerDisplayStatus("ACCEPTED", "FULFILLED"), "ACCEPTED");
    assert.equal(offerDisplayStatus("PENDING", "HAS_OFFERS"), "PENDING");
  });
});
