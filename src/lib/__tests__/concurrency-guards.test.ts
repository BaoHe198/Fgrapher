import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { Prisma } from "@prisma/client";

import { isUniqueViolation } from "@/lib/db-lock";

// Found 20/11/2026 by sending the same request several times in one instant
// (scripts kept out of the repo: they need a live database). These pin the
// shape of each fix, because every one of them was a correct-looking
// "read, check, write" that a later tidy-up could quietly restore.
const read = (path: string) => readFileSync(path, "utf8");
const body = (source: string, start: string, end = "\nexport ") => {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `missing ${start}`);
  const to = source.indexOf(end, from + start.length);
  return source.slice(from, to === -1 ? undefined : to);
};

describe("isUniqueViolation", () => {
  it("recognises a unique-constraint refusal and nothing else", () => {
    const make = (code: string) =>
      new Prisma.PrismaClientKnownRequestError("x", {
        code,
        clientVersion: "test",
      });
    assert.equal(isUniqueViolation(make("P2002")), true);
    assert.equal(isUniqueViolation(make("P2025")), false);
    assert.equal(isUniqueViolation(new Error("P2002")), false);
    assert.equal(isUniqueViolation(null), false);
  });
});

describe("one winner when two requests arrive together", () => {
  const bookings = read("src/services/bookings.ts");
  const offers = read("src/services/request-offers.ts");

  it("a booking changes status only from the status that was read", () => {
    const fn = body(bookings, "export async function transitionBooking");
    assert.match(
      fn,
      /updateMany\(\{\s*where: \{ id: bookingId, status: fromStatus \}/,
    );
    assert.doesNotMatch(fn, /tx\.booking\.update\(/);
  });

  it("the pending-booking cap is counted under the customer's lock", () => {
    const fn = body(bookings, "export async function createBooking");
    const lock = fn.indexOf("lockInTransaction(tx, `booking-cap:");
    const count = fn.indexOf("tx.booking.count");
    assert.ok(lock !== -1 && count > lock);
  });

  it("a reschedule answer applies only to the proposal that was read", () => {
    const fn = body(bookings, "export async function respondToReschedule");
    assert.match(fn, /rescheduleProposedBy: booking\.rescheduleProposedBy/);
    assert.match(fn, /answered\.count === 0/);
  });

  it("accepting an offer takes the request before a booking is made", () => {
    const fn = body(offers, "export async function acceptOffer");
    const claim = fn.indexOf("requestClaim");
    const offerClaim = fn.indexOf("offerClaim");
    const booking = fn.indexOf("createBooking(customerId");
    assert.ok(claim !== -1 && offerClaim > claim && booking > offerClaim);
    assert.match(
      fn,
      /await releaseClaims\(\);\s*if \(err instanceof BookingActionError\)/,
    );
  });

  it("cancelling a request is conditional on it still being open", () => {
    const fn = body(
      read("src/services/service-requests.ts"),
      "export async function cancelServiceRequest",
    );
    assert.match(
      fn,
      /updateMany\(\{\s*where: \{ id: requestId, status: \{ in: ACTIVE_REQUEST_STATUSES \} \}/,
    );
  });

  it("stock is taken only if it is still there, with the cart lines", () => {
    const orders = read("src/services/orders.ts");
    assert.match(orders, /stock: \{ gte: item\.quantity \}/);
    assert.match(orders, /tx\.cartItem\.deleteMany/);
  });

  it("a verification is decided only while it is pending", () => {
    const fn = body(
      read("src/services/admin.ts"),
      "export async function reviewVerification",
    );
    assert.match(
      fn,
      /where: \{ id: userRoleId, verificationStatus: "PENDING" \}/,
    );
  });

  it("a role-change request is claimed before it is applied", () => {
    const fn = body(
      read("src/services/role-change-requests.ts"),
      "export async function reviewRoleChangeRequest",
    );
    assert.ok(
      fn.indexOf("claim.count === 0") < fn.indexOf("applyRoleChangeReview("),
    );
  });

  it("find-or-create paths look and insert under a lock", () => {
    for (const [path, key] of [
      ["src/services/messaging.ts", "`conversation:${pairKey}`"],
      ["src/services/posts.ts", "`like:${userId}:${postId}`"],
      ["src/services/compliance.ts", "`deletion-request:${userId}`"],
      ["src/services/role-change-requests.ts", "`role-change:${userId}`"],
      ["src/services/service-requests.ts", '"service-request-code"'],
      ["src/app/api/reports/route.ts", "`report:${reporterId}:"],
      ["src/app/api/waitlist/route.ts", "`waitlist:${email.toLowerCase()}:"],
    ] as const) {
      assert.ok(read(path).includes(key), `${path} no longer locks ${key}`);
    }
  });
});
