import type { Role } from "@prisma/client";

import { ROLE_LABELS, ROLE_MONTHLY_PRICE } from "@/lib/constants";

// Server-only — references non-NEXT_PUBLIC env vars, so this module must
// never be imported from a Client Component (checkout route + server-
// rendered pricing/billing pages only).
export interface RolePlan {
  role: Role;
  priceId: string | undefined;
  name: string;
  monthly: number;
  currency: string;
}

export const ROLE_PLANS: Partial<Record<Role, RolePlan>> = {
  PHOTOGRAPHER: {
    role: "PHOTOGRAPHER",
    priceId: process.env.STRIPE_PRICE_PHOTOGRAPHER,
    name: ROLE_LABELS.PHOTOGRAPHER,
    monthly: ROLE_MONTHLY_PRICE.PHOTOGRAPHER!,
    currency: "USD",
  },
  VIDEOGRAPHER: {
    role: "VIDEOGRAPHER",
    priceId: process.env.STRIPE_PRICE_VIDEOGRAPHER,
    name: ROLE_LABELS.VIDEOGRAPHER,
    monthly: ROLE_MONTHLY_PRICE.VIDEOGRAPHER!,
    currency: "USD",
  },
  MAKEUP_ARTIST: {
    role: "MAKEUP_ARTIST",
    priceId: process.env.STRIPE_PRICE_MAKEUP_ARTIST,
    name: ROLE_LABELS.MAKEUP_ARTIST,
    monthly: ROLE_MONTHLY_PRICE.MAKEUP_ARTIST!,
    currency: "USD",
  },
  STUDIO: {
    role: "STUDIO",
    priceId: process.env.STRIPE_PRICE_STUDIO,
    name: ROLE_LABELS.STUDIO,
    monthly: ROLE_MONTHLY_PRICE.STUDIO!,
    currency: "USD",
  },
  CAMERA_SHOP: {
    role: "CAMERA_SHOP",
    priceId: process.env.STRIPE_PRICE_CAMERA_SHOP,
    name: ROLE_LABELS.CAMERA_SHOP,
    monthly: ROLE_MONTHLY_PRICE.CAMERA_SHOP!,
    currency: "USD",
  },
};
