import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createBookingSchema } from "@/lib/validations/booking";
import {
  MAX_REFERENCE_MEDIA,
  referenceUrlsForBooking,
} from "@/lib/validations/reference-media";
import { createServiceRequestSchema } from "@/lib/validations/service-request";

// Regression: accepting an offer turns a service request's references into
// the new booking's referenceImages (acceptOffer -> createBooking, via
// referenceUrlsForBooking). When the request allowed 10 references and the
// booking schema allowed 5, a request with 6-10 references produced booking
// input the booking schema rejects. It was only never rejected because
// acceptOffer didn't run that schema — so it would have broken the moment
// createBooking validated its own input. These tests pin one shared limit.

const url = (i: number) =>
  `https://res.cloudinary.com/demo/image/upload/v1/fgrapher/request/ref-${i}.jpg`;

const references = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ mediaUrl: url(i) }));

const validRequest = (count: number) => ({
  title: "Chụp ảnh cưới ngoại cảnh",
  role: "PHOTOGRAPHER",
  provinceId: "province-hcmc",
  isDateFlexible: true,
  references: references(count),
});

const validBooking = (referenceImages: string[]) => ({
  providerId: "provider-1",
  date: "2026-10-01",
  startTime: "10:00",
  locationType: "PROVIDER",
  referenceImages,
});

describe("reference media: one limit across request and booking", () => {
  it("every reference count a request accepts converts into a valid booking", () => {
    // The exact range the review flagged (6-10), plus both ends.
    for (let count = 0; count <= MAX_REFERENCE_MEDIA; count++) {
      const request = createServiceRequestSchema.safeParse(validRequest(count));
      assert.ok(
        request.success,
        `request with ${count} references should be valid`,
      );

      const booking = createBookingSchema.safeParse(
        validBooking(referenceUrlsForBooking(request.data.references ?? [])),
      );
      assert.ok(
        booking.success,
        `a ${count}-reference request must become a valid booking, got: ${
          booking.success ? "" : booking.error.issues[0]?.message
        }`,
      );
    }
  });

  it("carries every reference across, dropping none", () => {
    const refs = references(MAX_REFERENCE_MEDIA);
    assert.deepEqual(
      referenceUrlsForBooking(refs),
      refs.map((r) => r.mediaUrl),
    );
  });

  it("rejects one past the limit on BOTH sides, so the limit is real", () => {
    const over = MAX_REFERENCE_MEDIA + 1;
    assert.equal(
      createServiceRequestSchema.safeParse(validRequest(over)).success,
      false,
    );
    assert.equal(
      createBookingSchema.safeParse(
        validBooking(references(over).map((r) => r.mediaUrl)),
      ).success,
      false,
    );
  });

  it("refuses non-Cloudinary URLs on both sides", () => {
    const foreign = "https://evil.example.com/pixel.gif";
    assert.equal(
      createServiceRequestSchema.safeParse({
        ...validRequest(0),
        references: [{ mediaUrl: foreign }],
      }).success,
      false,
    );
    assert.equal(
      createBookingSchema.safeParse(validBooking([foreign])).success,
      false,
    );
  });
});
