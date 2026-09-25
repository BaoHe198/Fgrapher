import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { notificationHref } from "@/lib/notification-href";

describe("notificationHref", () => {
  it("opens the request for the customer who posted it", () => {
    assert.equal(
      notificationHref({
        type: "REQUEST_NEW_OFFER",
        data: { requestId: "r1" },
      }),
      "/dashboard/requests/r1",
    );
  });

  it("opens the opportunity for a provider", () => {
    assert.equal(
      notificationHref({
        type: "REQUEST_OFFER_DECLINED",
        data: { requestId: "r1" },
      }),
      "/dashboard/opportunities/r1",
    );
    assert.equal(
      notificationHref({
        type: "REQUEST_NEW_MATCH",
        data: { requestId: "r2" },
      }),
      "/dashboard/opportunities/r2",
    );
  });

  it("prefers the booking an accepted offer created", () => {
    assert.equal(
      notificationHref({
        type: "REQUEST_OFFER_ACCEPTED",
        data: { requestId: "r1", bookingId: "b1" },
      }),
      "/dashboard/bookings/b1",
    );
  });

  it("links posts, and falls back to the list", () => {
    assert.equal(
      notificationHref({ type: "NEW_COMMENT", data: { postId: "p1" } }),
      "/community/p1",
    );
    assert.equal(
      notificationHref({ type: "NEW_COMMENT", data: null }),
      "/dashboard/notifications",
    );
  });
});
