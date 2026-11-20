import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { REPORT_REASONS_BY_TARGET } from "@/lib/constants";
import {
  boxAround,
  distanceMeters,
  monthRuns,
  PLACE_CATEGORIES,
  placeSlug,
} from "@/lib/places";
import {
  adminPlaceUpdateSchema,
  placeMapSchema,
  placeProposalSchema,
} from "@/lib/validations/place";

// Photo spots on Fmap (project owner, 20/11/2026).

describe("a spot's address", () => {
  it("is the name without accents, in dashes", () => {
    assert.equal(placeSlug("Đồi chè Cầu Đất"), "doi-che-cau-dat");
    assert.equal(placeSlug("  Phố cổ Hội An!! "), "pho-co-hoi-an");
    assert.equal(
      placeSlug("Nhà thờ Đức Bà (Sài Gòn)"),
      "nha-tho-duc-ba-sai-gon",
    );
  });

  it("never comes out empty", () => {
    assert.equal(placeSlug("!!!"), "dia-diem");
  });
});

describe("best months", () => {
  it("joins consecutive months, across the new year too", () => {
    assert.deepEqual(monthRuns([11, 12, 1, 2]), [[11, 2]]);
    assert.deepEqual(monthRuns([3, 4, 9]), [
      [3, 4],
      [9, 9],
    ]);
    assert.deepEqual(monthRuns([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), [
      [1, 12],
    ]);
    assert.deepEqual(monthRuns([]), []);
  });
});

describe("distances", () => {
  it("measures metres on the ground", () => {
    // About 111 m per 0.001° of latitude.
    const d = distanceMeters(
      { latitude: 10.776, longitude: 106.7 },
      { latitude: 10.777, longitude: 106.7 },
    );
    assert.ok(d > 105 && d < 117, String(d));
  });

  it("a box reaches the distance asked in every direction", () => {
    const point = { latitude: 11.94, longitude: 108.44 };
    const box = boxAround(point, 200);
    for (const corner of [
      { latitude: box.north, longitude: point.longitude },
      { latitude: box.south, longitude: point.longitude },
      { latitude: point.latitude, longitude: box.east },
      { latitude: point.latitude, longitude: box.west },
    ]) {
      const d = distanceMeters(point, corner);
      assert.ok(d >= 199 && d <= 201, String(d));
    }
  });
});

const proposal = {
  name: "Đồi chè Cầu Đất",
  description: "Đồi chè trải dài, sương sớm đẹp nhất trước 7 giờ sáng.",
  kind: "FIELD",
  categories: ["WEDDING", "PORTRAIT"],
  provinceId: "p1",
  latitude: 11.86,
  longitude: 108.57,
  photos: [
    {
      url: "https://res.cloudinary.com/x/image/upload/a.jpg",
      publicId: "fgrapher/place/u1/a",
    },
  ],
  rightsConfirmed: true,
};

describe("what a proposal must carry", () => {
  it("a complete proposal passes", () => {
    const parsed = placeProposalSchema.safeParse(proposal);
    assert.ok(parsed.success, JSON.stringify(parsed.error?.issues));
    assert.deepEqual(parsed.data.bestMonths, []);
  });

  it("the photo-rights box must be ticked", () => {
    assert.ok(
      !placeProposalSchema.safeParse({ ...proposal, rightsConfirmed: false })
        .success,
    );
    const { rightsConfirmed: _omit, ...without } = proposal;
    void _omit;
    assert.ok(!placeProposalSchema.safeParse(without).success);
  });

  it("a pin outside Vietnam is a slip, not a spot", () => {
    assert.ok(
      !placeProposalSchema.safeParse({ ...proposal, latitude: 35.68 }).success,
    );
  });

  it("only on-location shoot styles", () => {
    assert.ok(
      !placeProposalSchema.safeParse({ ...proposal, categories: ["BRIDAL"] })
        .success,
    );
    assert.ok(!PLACE_CATEGORIES.includes("CYCLORAMA"));
  });

  it("a short description is refused", () => {
    assert.ok(
      !placeProposalSchema.safeParse({ ...proposal, description: "Đẹp." })
        .success,
    );
  });

  it("months are 1 to 12, sorted, once each", () => {
    const parsed = placeProposalSchema.parse({
      ...proposal,
      bestMonths: [12, 1, 12],
    });
    assert.deepEqual(parsed.bestMonths, [1, 12]);
    assert.ok(
      !placeProposalSchema.safeParse({ ...proposal, bestMonths: [13] }).success,
    );
  });
});

describe("an admin's partial edit", () => {
  it("leaves every fact it does not name untouched", () => {
    const parsed = adminPlaceUpdateSchema.parse({
      operatingStatus: "TEMPORARILY_CLOSED",
      statusNote: "",
    });
    assert.equal(parsed.bestMonths, undefined);
    assert.equal(parsed.categories, undefined);
    assert.equal(parsed.entryFeeVnd, undefined);
    assert.equal(parsed.statusNote, null);
  });
});

describe("the map layer's area", () => {
  it("refuses an inverted or continent-sized box", () => {
    const ok = { north: 11, south: 10, east: 107, west: 106 };
    assert.ok(placeMapSchema.safeParse(ok).success);
    assert.ok(!placeMapSchema.safeParse({ ...ok, north: 9 }).success);
    assert.ok(
      !placeMapSchema.safeParse({ ...ok, north: 40, south: 0 }).success,
    );
  });
});

describe("reporting a spot", () => {
  it("offers the reasons that fit a place", () => {
    assert.deepEqual(REPORT_REASONS_BY_TARGET.place.slice(0, 4), [
      "Wrong information",
      "Closed",
      "Private property",
      "Unsafe",
    ]);
    assert.ok(!REPORT_REASONS_BY_TARGET.user.includes("Closed"));
  });
});

describe("rules that live in the services", () => {
  const source = readFileSync("src/services/places.ts", "utf8");

  it("only verified providers and admins may propose", () => {
    assert.match(source, /verificationStatus: "VERIFIED"/);
    assert.match(source, /role: "ADMIN"/);
  });

  it("nothing is public before an admin approves it", () => {
    assert.match(
      source,
      /reviewStatus: "APPROVED",\s*deletedAt: null,\s*mergedIntoId: null/,
    );
  });

  it("every uploaded photo is checked on the server before it is saved", () => {
    assert.match(source, /verifyPlacePhotoUpload/);
  });

  it("photos wait for review unless an admin uploads them", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const model = schema.slice(schema.indexOf("model PlaceMedia"));
    assert.match(
      model,
      /moderationStatus\s+ModerationStatus @default\(PENDING\)/,
    );
    assert.match(model, /rightsConfirmedAt DateTime\n/);
  });
});
