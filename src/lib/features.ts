// Feature flags for functionality that's out of MVP scope but not
// removed from the codebase — see docs/MVP_SCOPE.md and
// docs/guides/fgrapher-danh-gia-va-prompt-sua-doi.md for why. Values
// come from src/lib/env.ts (already validated/typed there), not read
// from process.env directly here, so a typo'd env var fails the build
// the same way a missing required var does rather than silently
// defaulting.
import { env } from "@/lib/env";

export const features = {
  // Stripe can't take a merchant account for a Vietnam-registered
  // business — see CLAUDE.md's "Ràng buộc bắt buộc" #1. Plans are
  // assigned manually via /admin/users/[id] while this is false.
  billingEnabled: env.BILLING_ENABLED,
  // Product/Order/Cart/checkout and the CAMERA_SHOP role.
  marketplaceEnabled: env.MARKETPLACE_ENABLED,
  // Post/Like/Comment/Follow.
  socialFeedEnabled: env.SOCIAL_FEED_ENABLED,
} as const;
