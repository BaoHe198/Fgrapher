import type { Role } from "@prisma/client";

export const PAID_ROLES: Role[] = [
  "PHOTOGRAPHER",
  "VIDEOGRAPHER",
  "MAKEUP_ARTIST",
  "STUDIO",
  "CAMERA_SHOP",
];

// Roles that get a portfolio + booking-based nav section, as opposed to
// CAMERA_SHOP's product/order-based section.
export const PROVIDER_ROLES: Role[] = [
  "PHOTOGRAPHER",
  "VIDEOGRAPHER",
  "MAKEUP_ARTIST",
  "STUDIO",
];

export const ROLE_LABELS: Record<Role, string> = {
  PHOTOGRAPHER: "Photographer",
  VIDEOGRAPHER: "Videographer",
  MAKEUP_ARTIST: "Make-up Artist",
  STUDIO: "Studio",
  CAMERA_SHOP: "Camera Shop",
  CUSTOMER: "Customer",
  ADMIN: "Admin",
};
