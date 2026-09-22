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
  it("keeps product shops out of portfolio and booking capabilities", () => {
    assert.ok(SELLER_ROLES.includes("CAMERA_SHOP"));
    assert.ok(SELLER_ROLES.includes("COSTUME_SHOP"));
    assert.deepEqual(SHOP_ROLES, ["CAMERA_SHOP", "COSTUME_SHOP"]);
    assert.deepEqual(PORTFOLIO_ROLES, PROVIDER_ROLES);

    for (const shopRole of SHOP_ROLES) {
      assert.equal(PROVIDER_ROLES.includes(shopRole), false);
      assert.equal(PORTFOLIO_ROLES.includes(shopRole), false);
      for (const targets of Object.values(BOOKABLE_ROLES_BY_ROLE)) {
        assert.equal(targets?.includes(shopRole), false);
      }
    }
  });

  it("keeps camera and costume product categories separated", () => {
    assert.equal(
      productCategoryAllowedForRole("CAMERA_SHOP", "Camera body"),
      true,
    );
    assert.equal(
      productCategoryAllowedForRole("CAMERA_SHOP", "Wedding dress"),
      false,
    );
    assert.equal(
      productCategoryAllowedForRole("COSTUME_SHOP", "Wedding dress"),
      true,
    );
    assert.equal(
      productCategoryAllowedForRole("COSTUME_SHOP", "Camera body"),
      false,
    );
    assert.ok(productCategoriesForRole("COSTUME_SHOP").length > 0);
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
