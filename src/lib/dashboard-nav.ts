import type { Role } from "@prisma/client";

import { PROVIDER_ROLES, SELLER_ROLES } from "@/lib/constants";

/**
 * What the dashboard offers, and where (project owner, 20/11/2026).
 *
 * The menu used to list about fifteen entries side by side for a
 * photographer — their own work, their public page, their Chợ F shop and
 * the things they hire others for — and the parts of the job that matter
 * most (packages, service area, policies, working hours) sat inside
 * Settings → Profile next to the password and account deletion.
 *
 * Now each role gets the few things its job is made of; everything else
 * (selling and buying on Chợ F, hiring a crew, posting a request, saved
 * artists) lives on one page, "Tiện ích khác", and Settings is about the
 * account only. One model drives the desktop sidebar, the phone tab bar and
 * the "Thêm" sheet, so they cannot disagree.
 *
 * Pure: no React, no icons (the components map `icon` keys), so the rules
 * are unit-tested on their own.
 */
export type NavIcon =
  | "today"
  | "calendar"
  | "bookings"
  | "messages"
  | "jobs"
  | "myPage"
  | "shop"
  | "more"
  | "settings"
  | "admin"
  | "requests"
  | "newRequest"
  | "saved"
  | "moodboard"
  | "orders"
  | "notifications"
  | "places";

export interface DashboardNavItem {
  key: string;
  href: string;
  /** Key under sharedComponents.dashboardNav.items. */
  label: string;
  icon: NavIcon;
  /** Other paths that count as being "in" this item. */
  activePrefixes?: string[];
  /** Shows the unread-messages count. */
  badge?: "messages";
  /** A shorter label for the phone tab bar, where a tab is ~64px wide. */
  tabLabel?: string;
}

export interface DashboardNavFlags {
  roles: readonly Role[];
  marketplaceEnabled: boolean;
}

export type DashboardPersona =
  "provider" | "cameraShop" | "costumeShop" | "customer";

export function personaFor(roles: readonly Role[]): DashboardPersona {
  if (roles.some((role) => PROVIDER_ROLES.includes(role))) return "provider";
  if (roles.includes("CAMERA_SHOP")) return "cameraShop";
  if (roles.includes("COSTUME_SHOP")) return "costumeShop";
  return "customer";
}

/** Pages that are part of "Trang của tôi" — the hub and what it links to. */
export const MY_PAGE_PREFIXES = [
  "/dashboard/my-page",
  "/dashboard/portfolio",
  "/dashboard/services",
  "/dashboard/reviews",
  "/dashboard/share",
];

const ITEMS = {
  today: { key: "today", href: "/dashboard", label: "today", icon: "today" },
  overview: {
    key: "overview",
    href: "/dashboard",
    label: "overview",
    icon: "today",
  },
  calendar: {
    key: "calendar",
    href: "/dashboard/calendar",
    label: "calendar",
    tabLabel: "calendarTab",
    icon: "calendar",
  },
  bookings: {
    key: "bookings",
    href: "/dashboard/bookings",
    label: "bookings",
    icon: "bookings",
  },
  myBookings: {
    key: "myBookings",
    href: "/dashboard/bookings",
    label: "myBookings",
    tabLabel: "bookingsTab",
    icon: "bookings",
  },
  messages: {
    key: "messages",
    href: "/dashboard/messages",
    label: "messages",
    icon: "messages",
    badge: "messages",
  },
  jobs: {
    key: "jobs",
    href: "/dashboard/opportunities",
    label: "jobs",
    icon: "jobs",
    activePrefixes: ["/dashboard/my-offers"],
  },
  myPage: {
    key: "myPage",
    href: "/dashboard/my-page",
    label: "myPage",
    tabLabel: "myPageTab",
    icon: "myPage",
    activePrefixes: MY_PAGE_PREFIXES,
  },
  shop: {
    key: "shop",
    href: "/dashboard/listings",
    label: "shop",
    icon: "shop",
    activePrefixes: ["/dashboard/shop-orders"],
  },
  more: {
    key: "more",
    href: "/dashboard/more",
    label: "more",
    icon: "more",
  },
  settings: {
    key: "settings",
    href: "/dashboard/settings",
    label: "settings",
    icon: "settings",
  },
  admin: { key: "admin", href: "/admin", label: "admin", icon: "admin" },
  notifications: {
    key: "notifications",
    href: "/dashboard/notifications",
    label: "notifications",
    icon: "notifications",
  },
  newRequest: {
    key: "newRequest",
    href: "/requests/new",
    label: "newRequest",
    icon: "newRequest",
  },
  myRequests: {
    key: "myRequests",
    href: "/dashboard/requests",
    label: "myRequests",
    icon: "requests",
  },
  saved: { key: "saved", href: "/saved", label: "saved", icon: "saved" },
  moodboard: {
    key: "moodboard",
    href: "/moodboard",
    label: "moodboard",
    icon: "moodboard",
  },
  myOrders: {
    key: "myOrders",
    href: "/dashboard/orders",
    label: "myOrders",
    icon: "orders",
  },
} satisfies Record<string, DashboardNavItem>;

export interface DashboardNav {
  persona: DashboardPersona;
  /** The sidebar's first group: the job itself. */
  primary: DashboardNavItem[];
  /** The sidebar's second group: everything else, then settings. */
  secondary: DashboardNavItem[];
  /** The phone tab bar, at most five; the last one opens `sheet`. */
  tabs: DashboardNavItem[];
  /** What "Thêm" opens on a phone: primary items with no tab, then the rest. */
  sheet: DashboardNavItem[];
}

export function dashboardNav({
  roles,
  marketplaceEnabled,
}: DashboardNavFlags): DashboardNav {
  const persona = personaFor(roles);
  const isAdmin = roles.includes("ADMIN");
  const tail: DashboardNavItem[] = [
    ITEMS.notifications,
    ITEMS.settings,
    ...(isAdmin ? [ITEMS.admin] : []),
  ];

  if (persona === "customer") {
    // A customer's job is booking people: their "core" is what the
    // provider's "Tiện ích khác" holds, so it stays one short list.
    const primary: DashboardNavItem[] = [
      ITEMS.overview,
      ITEMS.myBookings,
      ITEMS.messages,
      ITEMS.myRequests,
      ITEMS.newRequest,
      ITEMS.saved,
      ITEMS.moodboard,
      ...(marketplaceEnabled ? [ITEMS.myOrders] : []),
    ];
    const tabs: DashboardNavItem[] = [
      ITEMS.overview,
      ITEMS.myBookings,
      ITEMS.messages,
      ITEMS.saved,
    ];
    return {
      persona,
      primary,
      secondary: [ITEMS.settings, ...(isAdmin ? [ITEMS.admin] : [])],
      tabs: [...tabs, ITEMS.more],
      sheet: [...primary.filter((item) => !tabs.includes(item)), ...tail],
    };
  }

  const primary: DashboardNavItem[] =
    persona === "provider"
      ? [
          ITEMS.today,
          ITEMS.calendar,
          ITEMS.bookings,
          ITEMS.messages,
          ITEMS.jobs,
          ITEMS.myPage,
        ]
      : persona === "cameraShop"
        ? [
            ITEMS.today,
            ...(marketplaceEnabled ? [ITEMS.shop] : []),
            ITEMS.messages,
            ITEMS.myPage,
          ]
        : [ITEMS.today, ITEMS.messages, ITEMS.myPage];

  const tabs: DashboardNavItem[] =
    persona === "provider"
      ? [ITEMS.today, ITEMS.calendar, ITEMS.messages, ITEMS.myPage]
      : primary.slice(0, 4);

  // Everything "Tiện ích khác" links to counts as being in it.
  const more: DashboardNavItem = {
    ...ITEMS.more,
    activePrefixes: [
      ...(persona === "cameraShop"
        ? []
        : ["/dashboard/listings", "/dashboard/shop-orders"]),
      "/dashboard/orders",
      "/dashboard/requests",
      "/saved",
      "/moodboard",
      "/dashboard/notifications",
      "/dashboard/places",
    ],
  };

  return {
    persona,
    primary,
    secondary: [more, ITEMS.settings, ...(isAdmin ? [ITEMS.admin] : [])],
    tabs: [...tabs, more],
    sheet: [...primary.filter((item) => !tabs.includes(item)), more, ...tail],
  };
}

/** What "Tiện ích khác" lists, grouped. Empty groups are dropped. */
export interface MoreGroup {
  key: "market" | "hiring" | "contribute" | "personal";
  items: DashboardNavItem[];
}

const SELL_ITEMS: DashboardNavItem[] = [
  {
    key: "listings",
    href: "/dashboard/listings",
    label: "listings",
    icon: "shop",
  },
  {
    key: "shopOrders",
    href: "/dashboard/shop-orders",
    label: "shopOrders",
    icon: "orders",
  },
];

export function moreGroups({
  roles,
  marketplaceEnabled,
}: DashboardNavFlags): MoreGroup[] {
  const persona = personaFor(roles);
  const sells =
    marketplaceEnabled &&
    persona !== "cameraShop" &&
    SELLER_ROLES.some((role) => roles.includes(role));
  const groups: MoreGroup[] = [
    {
      key: "market",
      items: marketplaceEnabled
        ? [...(sells ? SELL_ITEMS : []), ITEMS.myOrders]
        : [],
    },
    {
      key: "hiring",
      items:
        persona === "customer"
          ? []
          : [
              // A provider can book other people too (a model, a make-up
              // artist for a shoot): those are the "sent" side of bookings.
              {
                key: "sentBookings",
                href: "/dashboard/bookings?side=sent",
                label: "sentBookings",
                icon: "bookings",
              },
              ITEMS.newRequest,
              ITEMS.myRequests,
            ],
    },
    {
      // Photo spots on Fmap (services/places.ts): providers propose them.
      key: "contribute",
      items:
        persona === "customer"
          ? []
          : [
              {
                key: "places",
                href: "/dashboard/places",
                label: "places",
                icon: "places",
              },
            ],
    },
    {
      key: "personal",
      items: [ITEMS.saved, ITEMS.moodboard, ITEMS.notifications],
    },
  ];
  return groups.filter((group) => group.items.length > 0);
}

/** Is `pathname` inside this item (exact for the overview)? */
export function isNavItemActive(item: DashboardNavItem, pathname: string) {
  const path = item.href.split("?")[0];
  if (path === "/dashboard") return pathname === "/dashboard";
  return [path, ...(item.activePrefixes ?? [])].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export interface SectionTab {
  href: string;
  /** Key under sharedComponents.dashboardNav.sections.tabs. */
  label: string;
  /** Active on this exact path only (a hub whose children have tabs too). */
  exact?: boolean;
}

export interface SectionTabs {
  /** Key under sharedComponents.dashboardNav.sections. */
  label: "myPage" | "jobs" | "shop";
  tabs: SectionTab[];
}

const inPaths = (pathname: string, paths: string[]) =>
  paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

/**
 * The tab strip above a page that belongs to a section with several pages:
 * "Trang của tôi", "Tìm việc", a camera shop's "Cửa hàng". Null elsewhere.
 */
export function sectionTabs(
  pathname: string,
  { roles, marketplaceEnabled }: DashboardNavFlags,
): SectionTabs | null {
  const persona = personaFor(roles);
  if (persona === "customer") return null;

  if (inPaths(pathname, MY_PAGE_PREFIXES)) {
    return {
      label: "myPage",
      tabs: [
        { href: "/dashboard/my-page", label: "overview", exact: true },
        ...(persona === "provider"
          ? [
              { href: "/dashboard/portfolio", label: "portfolio" },
              { href: "/dashboard/services", label: "services" },
            ]
          : []),
        { href: "/dashboard/my-page/info", label: "info" },
        ...(persona === "provider"
          ? [
              { href: "/dashboard/reviews", label: "reviews" },
              { href: "/dashboard/share", label: "share" },
            ]
          : []),
      ],
    };
  }
  if (
    persona === "provider" &&
    inPaths(pathname, ["/dashboard/opportunities", "/dashboard/my-offers"])
  ) {
    return {
      label: "jobs",
      tabs: [
        { href: "/dashboard/opportunities", label: "opportunities" },
        { href: "/dashboard/my-offers", label: "myOffers" },
      ],
    };
  }
  if (
    persona === "cameraShop" &&
    marketplaceEnabled &&
    inPaths(pathname, ["/dashboard/listings", "/dashboard/shop-orders"])
  ) {
    return {
      label: "shop",
      tabs: [
        { href: "/dashboard/listings", label: "listings" },
        { href: "/dashboard/shop-orders", label: "shopOrders" },
      ],
    };
  }
  return null;
}

export function isSectionTabActive(tab: SectionTab, pathname: string) {
  return tab.exact
    ? pathname === tab.href
    : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}
