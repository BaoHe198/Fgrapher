import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

// processDeletion() once anonymised the user and left their open requests,
// pending offers, upcoming bookings, listings and posts live (19/11/2026).
// The behaviour was checked end to end against a database; these read the
// source so that removing a line from either function fails loudly.
const compliance = readFileSync("src/services/compliance.ts", "utf8");
const closure = readFileSync("src/services/account-closure.ts", "utf8");

const exportBody = compliance.slice(
  compliance.indexOf("export async function exportUserData("),
  compliance.indexOf("export async function requestDataExport("),
);
const deletionBody = compliance.slice(
  compliance.indexOf("export async function processDeletion("),
);

describe("account deletion", () => {
  it("closes live activity through the functions that own it", () => {
    assert.match(deletionBody, /await windDownAccount\(userId\)/);
    assert.match(closure, /transitionBooking\(\{/);
    assert.match(closure, /toStatus: "CANCELLED"/);
    assert.match(closure, /cancelServiceRequest\(request\.id, userId\)/);
    assert.match(closure, /withdrawOffer\(offer\.id, userId\)/);
    // Booking.status has one writer; this module must not become a second.
    assert.doesNotMatch(closure, /db\.booking\.update/);
  });

  it("winds activity down before the account loses its name", () => {
    assert.ok(
      deletionBody.indexOf("windDownAccount(userId)") <
        deletionBody.indexOf("DELETED_USER_LABEL"),
    );
  });

  it("takes the person's own content and traces out of public view", () => {
    for (const write of [
      "db.product.updateMany(",
      "db.post.updateMany(",
      "db.comment.updateMany(",
      "db.like.deleteMany(",
      "db.follow.deleteMany(",
      "db.savedProfile.deleteMany(",
      "db.cartItem.deleteMany(",
      "db.notification.deleteMany(",
      "db.account.deleteMany(",
      "db.emailOutbox.deleteMany(",
      "db.waitlistEntry.deleteMany(",
      "db.serviceRequest.deleteMany(",
      "db.serviceRequest.updateMany(",
      // Photo spots: their photos leave the spot pages, their unapproved
      // proposals go, and approved spots stop pointing at them.
      "db.placeMedia.updateMany(",
      "db.place.updateMany(",
    ]) {
      assert.ok(deletionBody.includes(write), write);
    }
    assert.match(
      deletionBody,
      /detailedAddress: null, areaNote: null, description: null/,
    );
  });

  it("keeps the consent history, which is evidence", () => {
    assert.doesNotMatch(deletionBody, /consentRecord\.(delete|update)/);
  });
});

describe("data export", () => {
  it("covers what deletion removes", () => {
    for (const read of [
      "db.serviceRequest.findMany(",
      "db.requestOffer.findMany(",
      "db.post.findMany(",
      "db.comment.findMany(",
      "db.product.findMany(",
      "db.productReview.findMany(",
      "db.savedProfile.findMany(",
      "db.follow.findMany(",
      "db.place.findMany(",
      "db.placeMedia.findMany(",
    ]) {
      assert.ok(exportBody.includes(read), read);
    }
    assert.doesNotMatch(exportBody, /passwordHash/);
  });
});
