import type { ExperienceLevel, ProfileCategory, Role } from "@prisma/client";

// Bump this whenever the privacy/data-processing policy text changes —
// every ConsentRecord stores the version that was current when it was
// created, so consent history stays interpretable ("they agreed to v1,
// which said X; the policy now says Y"). See services/compliance.ts.
export const CURRENT_POLICY_VERSION = "2026-08-23-v1";

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
