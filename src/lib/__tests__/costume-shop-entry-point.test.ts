import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  BOOKABLE_ROLES_BY_ROLE,
  PROVIDER_ROLES,
  SELLER_ROLES,
} from "@/lib/constants";

// QA-06 (22/09/2026): a costume shop's catalogue works and is in the right
// place — outfits live on its profile and are rented through chat, not sold
// on Chợ F. What was missing was any way in. The sidebar had no entry, and
// typing /dashboard/listings answered with "add a role that can sell",
// which reads as "this role cannot post anything".
//
// The architecture is deliberate (CLAUDE.md, 22/09/2026) and these tests
// keep it that way while pinning the entry point that was added.

const repoRoot = path.resolve(__dirname, "../../..");
const CATALOGUE_HREF =
  "/dashboard/settings/profile?section=roleProfile#costumes";

function source(file: string): string {
  return readFileSync(path.join(repoRoot, file), "utf8");
}

describe("COSTUME_SHOP vẫn nằm ngoài Chợ F và luồng đặt lịch", () => {
  it("không phải vai trò bán hàng trên Chợ F", () => {
    assert.ok(!(SELLER_ROLES as readonly string[]).includes("COSTUME_SHOP"));
  });

  it("không nhận booking", () => {
    assert.ok(!(PROVIDER_ROLES as readonly string[]).includes("COSTUME_SHOP"));
    // No entry at all, and never a target of anyone else's booking either.
    assert.equal(BOOKABLE_ROLES_BY_ROLE.COSTUME_SHOP, undefined);
    for (const targets of Object.values(BOOKABLE_ROLES_BY_ROLE)) {
      assert.ok(!(targets ?? []).includes("COSTUME_SHOP"));
    }
  });
});

describe("lối vào danh mục trang phục", () => {
  it("sidebar có mục riêng cho COSTUME_SHOP", () => {
    const sidebar = source("src/components/layout/dashboard-sidebar.tsx");
    assert.match(sidebar, /hasRole\("COSTUME_SHOP"\)/);
    assert.ok(
      sidebar.includes(CATALOGUE_HREF),
      "the sidebar entry no longer points at the outfit catalogue",
    );
  });

  it("mục đó mở đúng phần chứa CostumesManager", () => {
    // The catalogue sits inside a collapsed accordion panel, so the link has
    // to say which section to open — an anchor alone lands on a page where
    // every panel is shut.
    const settings = source(
      "src/app/(dashboard)/dashboard/settings/profile/page.tsx",
    );
    assert.match(settings, /section === "roleProfile"/);
    assert.match(settings, /<AccordionItem value="roleProfile">/);

    const manager = source(
      "src/app/(dashboard)/dashboard/settings/profile/costumes-manager.tsx",
    );
    assert.match(manager, /id="costumes"/);
  });

  it("/dashboard/listings hướng COSTUME_SHOP về catalogue, không về thêm vai trò", () => {
    const listings = source("src/app/(dashboard)/dashboard/listings/page.tsx");
    assert.match(listings, /roles\.includes\("COSTUME_SHOP"\)/);
    assert.ok(listings.includes(CATALOGUE_HREF));
  });

  it("thông báo không còn nói chỉ Cửa hàng máy ảnh mới đăng tin được", () => {
    // SELLER_ROLES has four roles in it; the old copy named one.
    const vi = JSON.parse(source("src/messages/vi.json")) as {
      dashboardCore: {
        listings: { roleRequired: Record<string, string> };
      };
    };
    const copy = vi.dashboardCore.listings.roleRequired;
    for (const key of [
      "costumeShopTitle",
      "costumeShopBody",
      "costumeShopCta",
    ]) {
      assert.ok(copy[key], `missing costume-shop copy: ${key}`);
    }
    assert.match(copy.body, /Nhiếp ảnh gia/);
  });
});
