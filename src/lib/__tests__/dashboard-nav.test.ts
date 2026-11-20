import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import type { Role } from "@prisma/client";

import {
  dashboardNav,
  isNavItemActive,
  isSectionTabActive,
  moreGroups,
  sectionTabs,
} from "@/lib/dashboard-nav";

const nav = (roles: Role[], marketplaceEnabled = true) =>
  dashboardNav({ roles, marketplaceEnabled });
const keys = (items: { key: string }[]) => items.map((item) => item.key);

// Project owner, 20/11/2026: a provider's menu is the job; selling, buying,
// hiring and posting requests live in "Tiện ích khác"; settings are about
// the account. These pin that per role.
describe("what each role's menu holds", () => {
  it("a photographer: the job, then more and settings", () => {
    const n = nav(["CUSTOMER", "PHOTOGRAPHER"]);
    assert.deepEqual(keys(n.primary), [
      "today",
      "calendar",
      "bookings",
      "messages",
      "jobs",
      "myPage",
    ]);
    assert.deepEqual(keys(n.secondary), ["more", "settings"]);
    assert.deepEqual(keys(n.tabs), [
      "today",
      "calendar",
      "messages",
      "myPage",
      "more",
    ]);
    assert.deepEqual(keys(n.sheet), [
      "bookings",
      "jobs",
      "more",
      "notifications",
      "settings",
    ]);
  });

  it("selling and hiring are never in a provider's main menu", () => {
    for (const role of [
      "PHOTOGRAPHER",
      "VIDEOGRAPHER",
      "MAKEUP_ARTIST",
      "STUDIO",
      "MODEL",
    ] as Role[]) {
      const hrefs = nav(["CUSTOMER", role]).primary.map((item) => item.href);
      for (const secondary of [
        "/dashboard/listings",
        "/dashboard/shop-orders",
        "/dashboard/orders",
        "/requests/new",
        "/dashboard/requests",
        "/saved",
        "/moodboard",
      ]) {
        assert.ok(!hrefs.includes(secondary), `${role} has ${secondary}`);
      }
    }
  });

  it("every phone menu has at most five tabs and ends with 'Thêm'", () => {
    for (const roles of [
      ["CUSTOMER"],
      ["CUSTOMER", "PHOTOGRAPHER"],
      ["CUSTOMER", "COSTUME_SHOP"],
      ["CUSTOMER", "CAMERA_SHOP"],
      ["CUSTOMER", "ADMIN"],
    ] as Role[][]) {
      const n = nav(roles);
      assert.ok(n.tabs.length <= 5, roles.join());
      assert.equal(n.tabs.at(-1)?.key, "more", roles.join());
    }
  });

  it("nothing in the main menu is out of reach on a phone", () => {
    for (const roles of [
      ["CUSTOMER"],
      ["CUSTOMER", "PHOTOGRAPHER"],
      ["CUSTOMER", "COSTUME_SHOP"],
      ["CUSTOMER", "CAMERA_SHOP"],
    ] as Role[][]) {
      const n = nav(roles);
      const onPhone = new Set([...keys(n.tabs), ...keys(n.sheet)]);
      for (const item of [...n.primary, ...n.secondary]) {
        assert.ok(
          onPhone.has(item.key),
          `${roles.join()} cannot reach ${item.key} on a phone`,
        );
      }
    }
  });

  it("a camera shop's shop is its job; a costume shop has no shop entry", () => {
    assert.ok(keys(nav(["CUSTOMER", "CAMERA_SHOP"]).primary).includes("shop"));
    assert.ok(
      !keys(nav(["CUSTOMER", "CAMERA_SHOP"], false).primary).includes("shop"),
    );
    assert.ok(
      !keys(nav(["CUSTOMER", "COSTUME_SHOP"]).primary).includes("shop"),
    );
  });

  it("a customer keeps one short list and a Profile in settings", () => {
    const n = nav(["CUSTOMER"]);
    assert.deepEqual(keys(n.tabs), [
      "overview",
      "myBookings",
      "messages",
      "saved",
      "more",
    ]);
    assert.ok(!keys(n.primary).includes("myPage"));
    assert.ok(!keys(n.primary).includes("jobs"));
  });

  it("an admin also gets the admin link", () => {
    assert.ok(keys(nav(["CUSTOMER", "ADMIN"]).secondary).includes("admin"));
    assert.ok(keys(nav(["CUSTOMER", "ADMIN"]).sheet).includes("admin"));
  });
});

describe("Tiện ích khác", () => {
  it("a photographer finds selling, buying, hiring and saved things there", () => {
    const groups = moreGroups({
      roles: ["CUSTOMER", "PHOTOGRAPHER"],
      marketplaceEnabled: true,
    });
    assert.deepEqual(
      groups.map((g) => g.key),
      ["market", "hiring", "personal"],
    );
    assert.deepEqual(keys(groups[0].items), [
      "listings",
      "shopOrders",
      "myOrders",
    ]);
    assert.deepEqual(keys(groups[1].items), [
      "sentBookings",
      "newRequest",
      "myRequests",
    ]);
  });

  it("with Chợ F off there is no Chợ F group", () => {
    const groups = moreGroups({
      roles: ["CUSTOMER", "PHOTOGRAPHER"],
      marketplaceEnabled: false,
    });
    assert.ok(!groups.some((g) => g.key === "market"));
  });

  it("a make-up artist (cannot sell) only buys", () => {
    const market = moreGroups({
      roles: ["CUSTOMER", "MAKEUP_ARTIST"],
      marketplaceEnabled: true,
    }).find((g) => g.key === "market");
    assert.deepEqual(keys(market?.items ?? []), ["myOrders"]);
  });
});

describe("which entry is lit", () => {
  const item = (key: string, roles: Role[] = ["CUSTOMER", "PHOTOGRAPHER"]) => {
    const n = nav(roles);
    return [...n.primary, ...n.secondary].find((i) => i.key === key)!;
  };

  it("Trang của tôi stays lit on every page it holds", () => {
    for (const path of [
      "/dashboard/my-page",
      "/dashboard/my-page/info",
      "/dashboard/portfolio",
      "/dashboard/portfolio/abc",
      "/dashboard/services",
      "/dashboard/reviews",
      "/dashboard/share",
    ]) {
      assert.ok(isNavItemActive(item("myPage"), path), path);
    }
  });

  it("Hôm nay is lit on the overview only", () => {
    assert.ok(isNavItemActive(item("today"), "/dashboard"));
    assert.ok(!isNavItemActive(item("today"), "/dashboard/calendar"));
  });

  it("a prefix is a whole path segment", () => {
    assert.ok(!isNavItemActive(item("calendar"), "/dashboard/calendarx"));
  });

  it("Tiện ích khác is lit on what it links to", () => {
    for (const path of [
      "/dashboard/more",
      "/dashboard/orders",
      "/saved",
      "/dashboard/listings",
    ]) {
      assert.ok(isNavItemActive(item("more"), path), path);
    }
  });
});

describe("tabs above a section's pages", () => {
  const flags = {
    roles: ["CUSTOMER", "PHOTOGRAPHER"] as Role[],
    marketplaceEnabled: true,
  };

  it("Trang của tôi has its six tabs; the overview tab is exact", () => {
    const section = sectionTabs("/dashboard/my-page/info", flags);
    assert.equal(section?.label, "myPage");
    assert.deepEqual(
      section?.tabs.map((t) => t.label),
      ["overview", "portfolio", "services", "info", "reviews", "share"],
    );
    const lit = section!.tabs.filter((t) =>
      isSectionTabActive(t, "/dashboard/my-page/info"),
    );
    assert.deepEqual(
      lit.map((t) => t.label),
      ["info"],
    );
  });

  it("Tìm việc has requests and offers", () => {
    assert.equal(sectionTabs("/dashboard/my-offers", flags)?.label, "jobs");
  });

  it("a customer's pages have none", () => {
    assert.equal(
      sectionTabs("/dashboard/bookings", {
        roles: ["CUSTOMER"],
        marketplaceEnabled: true,
      }),
      null,
    );
  });
});

describe("where the old Settings → Profile went", () => {
  const read = (path: string) => readFileSync(path, "utf8");

  it("a provider's old profile links land on the new pages", () => {
    const source = read(
      "src/app/(dashboard)/dashboard/settings/profile/page.tsx",
    );
    assert.match(source, /"\/dashboard\/calendar\?hours=1"/);
    assert.match(source, /"\/dashboard\/my-page\/info"/);
  });

  it("nothing in the app still links into Settings → Profile sections", () => {
    for (const path of [
      "src/services/dashboard.ts",
      "src/app/(dashboard)/dashboard/share/page.tsx",
      "src/app/(dashboard)/dashboard/provider-overview.tsx",
      "src/app/(dashboard)/dashboard/calendar/calendar-client.tsx",
      "src/components/layout/dashboard-sidebar.tsx",
    ]) {
      assert.doesNotMatch(read(path), /settings\/profile\?section=/, path);
    }
  });

  it("the details page leaves packages to their own page", () => {
    assert.match(
      read("src/app/(dashboard)/dashboard/my-page/info/page.tsx"),
      /showServices=\{false\}/,
    );
  });
});
