import type { ExperienceLevel, ProfileCategory, Role } from "@prisma/client";

// Prompt F4 — the app's full z-index stacking order, gathered from every
// existing z-* Tailwind class in src/ at the time this was written:
//   0-10   → in-flow decorative layers (calendar cell rings, avatar badges)
//   Z_INDEX.stickyBanner (10) → past-due billing banner
//   Z_INDEX.stickyHeader (20) → the site header (web-nav.tsx)
//   Z_INDEX.messagingPanel (30) → the global floating messages popup below
//   Z_INDEX.overlay (50) → Dialog/Sheet/DropdownMenu/Select/media lightbox
//     (all portalled Base UI primitives — they already stack correctly
//     relative to EACH OTHER by portal/open order, so they intentionally
//     share one tier rather than being individually renumbered here)
//   Z_INDEX.toast (~1000, computed as 1000 - index) → src/components/ui/toast.tsx
// Existing components still hardcode their own Tailwind z-* class (Tailwind
// utility classes can't reference a JS constant without a broader
// CSS-variable refactor of every one of those files) — this object is the
// documented source of truth new code should match, and what the
// messaging panel below actually uses.
export const Z_INDEX = {
  stickyBanner: 10,
  stickyHeader: 20,
  messagingPanel: 30,
  overlay: 50,
} as const;

// Bump this whenever the privacy/data-processing policy text changes —
// every ConsentRecord stores the version that was current when it was
// created, so consent history stays interpretable ("they agreed to v1,
// which said X; the policy now says Y"). See services/compliance.ts.
export const CURRENT_POLICY_VERSION = "2026-08-23-v1";

// Deadline shown on /admin/compliance's DataRequest queue — computed as
// requestedAt + this many days, not stored on the row itself.
export const DATA_REQUEST_SLA_DAYS = 30;

// Minimum lead time for a booking request. Used both to reject a
// too-soon createBooking call server-side (services/bookings.ts) and to
// mark a slot unavailable in the first place (services/availability.ts) —
// previously each file defined its own identical `const
// MIN_NOTICE_HOURS = 24`, plus a third hardcoded copy
// (`dashboard/bookings/[id]/page.tsx`'s within-24h cancellation warning)
// that carried the same number with no shared source.
export const MIN_NOTICE_HOURS = 24;

// CLAUDE.md rule 7 — ID document images auto-delete after 90 days,
// regardless of whether the verification was approved, rejected, or never
// reviewed at all. Set on UserRole.purgeAfter at both submission time
// (services/verification.ts's submitVerification, covering the
// never-reviewed case) and review time (services/admin.ts's
// reviewVerification, both branches — approval resets the clock rather
// than purging a just-verified provider's documents immediately).
export const KYC_PURGE_AFTER_DAYS = 90;

// Preset options shown on /admin/verifications' reject flow — the admin
// picks one (plus an optional free-text note), combined client-side into
// the single string stored in UserRole.verificationRejectedReason.
export const KYC_REJECTION_REASONS = [
  "Ảnh mờ hoặc không đọc được",
  "Giấy tờ hết hạn",
  "Thông tin không khớp với hồ sơ",
  "Ảnh selfie không cầm giấy tờ rõ ràng",
  "Nghi ngờ ảnh đã bị chỉnh sửa",
  "Khác",
] as const;

// Prompt F3, VIỆC 5 — every fixed-grid calendar in the app displays
// Monday-first (Vietnamese convention), matching date-fns' weekStartsOn
// contract (1 = Monday). This does NOT change the stored day-of-week
// numbering used everywhere else (0=Sunday..6=Saturday, matching
// Prisma's Availability.dayOfWeek and JS Date.getUTCDay()) — see
// mondayFirstColumn() in lib/utils.ts for converting between the two.
export const WEEK_STARTS_ON = 1;

// Monday-first short labels for a fixed weekly grid header. Deliberately
// its own constant rather than reusing formatWeekdayShort() (Intl
// "vi-VN" short weekday, e.g. "Th 2") — that formatter is also used for
// per-day labels on the rolling-window booking widgets, which isn't a
// week-start bug (see F3 VIỆC 5's investigation notes) and shouldn't
// change format there.
export const WEEKDAY_SHORT_LABELS_VI = [
  "T2",
  "T3",
  "T4",
  "T5",
  "T6",
  "T7",
  "CN",
] as const;

// Hours before a PENDING ProfileMedia row is flagged overdue on
// /admin/moderation — the SLA target from Prompt B5's VIỆC 6.
export const MEDIA_MODERATION_SLA_HOURS = 24;

// Preset options shown on /admin/moderation's reject flow, mirroring
// KYC_REJECTION_REASONS' pattern for the identity-verification queue.
export const MEDIA_REJECTION_REASONS = [
  "Ảnh khỏa thân hoặc khiêu dâm",
  "Ảnh phô bày cơ thể mang tính gợi dục",
  "Nghi ngờ người trong ảnh dưới 18 tuổi",
  "Không có bằng chứng về quyền sử dụng ảnh",
  "Ảnh chất lượng thấp / không liên quan đến dịch vụ",
  "Khác",
] as const;

export const PAID_ROLES: Role[] = [
  "PHOTOGRAPHER",
  "VIDEOGRAPHER",
  "MAKEUP_ARTIST",
  "STUDIO",
  "CAMERA_SHOP",
  "MODEL",
];

// Roles that get a portfolio + booking-based nav section, as opposed to
// CAMERA_SHOP's product/order-based section.
export const PROVIDER_ROLES: Role[] = [
  "PHOTOGRAPHER",
  "VIDEOGRAPHER",
  "MAKEUP_ARTIST",
  "STUDIO",
  "MODEL",
];

export const ROLE_LABELS: Record<Role, string> = {
  PHOTOGRAPHER: "Photographer",
  VIDEOGRAPHER: "Videographer",
  MAKEUP_ARTIST: "Make-up Artist",
  STUDIO: "Studio",
  CAMERA_SHOP: "Camera Shop",
  MODEL: "Model",
  CUSTOMER: "Customer",
  ADMIN: "Admin",
};

// Prompt B4, VIỆC 5 — kebab-case URL slugs for the /[roleSlug]/[provinceSlug]
// SEO landing pages (see src/app/(public)/[roleSlug]/[provinceSlug]).
// PAID_ROLES-scoped (excludes CUSTOMER/ADMIN, which have no public landing
// page). CAMERA_SHOP's slug exists but the route itself only statically
// generates it when MARKETPLACE_ENABLED.
export const ROLE_SLUGS: Partial<Record<Role, string>> = {
  PHOTOGRAPHER: "photographer",
  VIDEOGRAPHER: "videographer",
  MAKEUP_ARTIST: "makeup-artist",
  STUDIO: "studio",
  CAMERA_SHOP: "camera-shop",
  MODEL: "model",
};

export const SLUG_TO_ROLE: Partial<Record<string, Role>> = Object.fromEntries(
  Object.entries(ROLE_SLUGS).map(([role, slug]) => [slug, role as Role]),
);

// Shared with report-modal.tsx and lib/validations/review.ts's
// reportSchema. "Inappropriate content" and "Appears to be a minor" are
// routed to a high-priority admin queue — see HIGH_PRIORITY_REPORT_REASONS
// and services/admin.ts's report handling.
export const REPORT_REASONS = [
  "Spam",
  "Fake",
  "Offensive",
  "Off-topic",
  "Personal information",
  "Inappropriate content",
  "Appears to be a minor",
  "Other",
] as const;

export const HIGH_PRIORITY_REPORT_REASONS: (typeof REPORT_REASONS)[number][] = [
  "Inappropriate content",
  "Appears to be a minor",
];

// Category groupings from the ProfileCategory enum, by which role they
// apply to — drives the browse page's "Style" filter (only shown once a
// single role is selected, since categories are role-specific).
export const CATEGORIES_BY_ROLE: Partial<Record<Role, ProfileCategory[]>> = {
  PHOTOGRAPHER: [
    "WEDDING",
    "PORTRAIT",
    "FASHION",
    "COMMERCIAL",
    "EVENT",
    "PRODUCT",
    "FOOD",
    "LANDSCAPE",
    "STREET",
    "DOCUMENTARY",
    "CORPORATE",
    "REAL_ESTATE",
  ],
  VIDEOGRAPHER: [
    "WEDDING",
    "EVENT",
    "MUSIC_VIDEO",
    "CORPORATE",
    "DOCUMENTARY",
    "COMMERCIAL",
  ],
  MAKEUP_ARTIST: ["BRIDAL", "EDITORIAL", "SFX", "NATURAL", "GLAM"],
  STUDIO: ["INDOOR", "OUTDOOR", "ROOFTOP", "CYCLORAMA", "GREEN_SCREEN"],
  MODEL: [
    "FASHION_MODEL",
    "COMMERCIAL_MODEL",
    "FITNESS_MODEL",
    "PORTRAIT_MODEL",
    "HAND_FOOT_MODEL",
    "PLUS_SIZE",
    "PETITE",
    "MATURE",
    "ALTERNATIVE",
  ],
};

export const CATEGORY_LABELS: Record<ProfileCategory, string> = {
  WEDDING: "Wedding",
  PORTRAIT: "Portrait",
  FASHION: "Fashion",
  COMMERCIAL: "Commercial",
  EVENT: "Event",
  PRODUCT: "Product",
  FOOD: "Food",
  LANDSCAPE: "Landscape",
  STREET: "Street",
  DOCUMENTARY: "Documentary",
  MUSIC_VIDEO: "Music video",
  CORPORATE: "Corporate",
  REAL_ESTATE: "Real estate",
  BRIDAL: "Bridal",
  EDITORIAL: "Editorial",
  SFX: "SFX",
  NATURAL: "Natural",
  GLAM: "Glam",
  INDOOR: "Indoor",
  OUTDOOR: "Outdoor",
  ROOFTOP: "Rooftop",
  CYCLORAMA: "Cyclorama",
  GREEN_SCREEN: "Green screen",
  FASHION_MODEL: "Fashion",
  COMMERCIAL_MODEL: "Commercial",
  FITNESS_MODEL: "Fitness",
  PORTRAIT_MODEL: "Portrait",
  HAND_FOOT_MODEL: "Hand & foot",
  PLUS_SIZE: "Plus size",
  PETITE: "Petite",
  MATURE: "Mature",
  ALTERNATIVE: "Alternative",
};

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  NEW: "New",
  INTERMEDIATE: "Intermediate",
  EXPERIENCED: "Experienced",
  PROFESSIONAL: "Professional",
};

// Canonical ExperienceLevel enum order for building select options — pairs
// with the "experienceLevel" next-intl namespace (t(level)) rather than
// EXPERIENCE_LEVEL_LABELS, which stays English-only and unused in UI now.
export const EXPERIENCE_LEVELS: ExperienceLevel[] = [
  "NEW",
  "INTERMEDIATE",
  "EXPERIENCED",
  "PROFESSIONAL",
];

// Roles a given role can send booking requests to. MODEL only appears as a
// value (it receives bookings, never initiates them) — see the "who can
// book whom" table in .claude/skills/role-permissions/SKILL.md.
export const BOOKABLE_ROLES_BY_ROLE: Partial<Record<Role, Role[]>> = {
  CUSTOMER: [
    "PHOTOGRAPHER",
    "VIDEOGRAPHER",
    "MAKEUP_ARTIST",
    "STUDIO",
    "MODEL",
  ],
  PHOTOGRAPHER: ["MAKEUP_ARTIST", "STUDIO", "MODEL"],
  VIDEOGRAPHER: ["MAKEUP_ARTIST", "STUDIO", "MODEL"],
};
