import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BOOKABLE_ROLES_BY_ROLE,
  PORTFOLIO_ROLES,
  PROVIDER_ROLES,
  SELLER_ROLES,
  SHOP_ROLES,
} from "@/lib/constants";
import {
  productCategoryAllowedForRole,
  productCategoriesForRole,
} from "@/lib/validations/product";
import { createServiceRequestSchema } from "@/lib/validations/service-request";
import { submitVerificationSchema } from "@/lib/validations/verification";

describe("role capability boundaries", () => {
  // The two shop roles are NOT interchangeable, and the difference is the
  // thing this file exists to pin down (project owner, 21/09/2026,
  // reconfirmed 22/09/2026):
  //
  //   CAMERA_SHOP   sells gear on Chợ F. No portfolio, no services, no
  //                 bookings — its profile is a product listing.
  //   COSTUME_SHOP  is a provider: it takes bookings for a date and has a
  //                 portfolio, and its outfits are a catalogue on its own
  //                 profile, NOT products on Chợ F.
  it("keeps the camera shop out of portfolio and booking capabilities", () => {
    assert.ok(SELLER_ROLES.includes("CAMERA_SHOP"));
    assert.equal(PROVIDER_ROLES.includes("CAMERA_SHOP"), false);
    assert.equal(PORTFOLIO_ROLES.includes("CAMERA_SHOP"), false);
    for (const targets of Object.values(BOOKABLE_ROLES_BY_ROLE)) {
      assert.equal(targets?.includes("CAMERA_SHOP"), false);
    }
  });

  it("keeps the costume shop off Chợ F and off the booking flows", () => {
    // Its profile is a catalogue: pick an outfit, message the shop, agree
    // the dates and deposit in the chat (project owner, 22/09/2026).
    assert.equal(SELLER_ROLES.includes("COSTUME_SHOP"), false);
    assert.equal(PROVIDER_ROLES.includes("COSTUME_SHOP"), false);
    for (const targets of Object.values(BOOKABLE_ROLES_BY_ROLE)) {
      assert.equal(targets?.includes("COSTUME_SHOP"), false);
    }
  });

  it("still lets the costume shop upload photos, unlike the camera shop", () => {
    // Every outfit points at a ProfileMedia row, which is what puts outfit
    // photos through the portfolio moderation queue. The public profile
    // shows no portfolio tab — only the catalogue.
    assert.ok(PORTFOLIO_ROLES.includes("COSTUME_SHOP"));
    assert.equal(PORTFOLIO_ROLES.includes("CAMERA_SHOP"), false);
  });

  it("still calls both of them shops, for naming and shop-name purposes", () => {
    assert.deepEqual(SHOP_ROLES, ["CAMERA_SHOP", "COSTUME_SHOP"]);
  });

  it("carries only equipment categories on Chợ F", () => {
    assert.equal(
      productCategoryAllowedForRole("CAMERA_SHOP", "Camera body"),
      true,
    );
    // Outfit categories are not product categories at all any more — a
    // costume shop cannot list on Chợ F, so nothing should accept one.
    assert.equal(
      productCategoryAllowedForRole("CAMERA_SHOP", "Wedding dress"),
      false,
    );
    assert.equal(
      productCategoryAllowedForRole("PHOTOGRAPHER", "Wedding dress"),
      false,
    );
    assert.ok(productCategoriesForRole("PHOTOGRAPHER").length > 0);
  });

  it("allows Costume Shop to submit KYC", () => {
    const parsed = submitVerificationSchema.safeParse({
      role: "COSTUME_SHOP",
      fullName: "Nguyen Van A",
      idNumber: "123456789012",
      idFrontUrl: "https://example.com/front.jpg",
      idFrontPublicId: "front",
      idBackUrl: "https://example.com/back.jpg",
      idBackPublicId: "back",
      selfieUrl: "https://example.com/selfie.jpg",
      selfiePublicId: "selfie",
      consentIdentityVerification: true,
    });
    assert.equal(parsed.success, true);
  });

  it("rejects shop roles as service-request recipients", () => {
    const base = {
      title: "Can nguoi chup anh",
      provinceId: "province-1",
      categories: [],
      isDateFlexible: true,
      isDraft: false,
    };
    assert.equal(
      createServiceRequestSchema.safeParse({
        ...base,
        role: "PHOTOGRAPHER",
      }).success,
      true,
    );
    assert.equal(
      createServiceRequestSchema.safeParse({
        ...base,
        role: "COSTUME_SHOP",
      }).success,
      false,
    );
  });
});
