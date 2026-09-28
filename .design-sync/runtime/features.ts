// Design-sync stand-in for src/lib/features.ts, whose real values come from
// server environment variables that don't exist in the browser. These match
// production as of 28/09/2026 so designs show what users actually see.
export const features = {
  billingEnabled: false,
  freeRoleGrantEnabled: true,
  marketplaceEnabled: true,
  socialFeedEnabled: true,
  phoneVerificationRequired: false,
  momoEnabled: false,
  zalopayEnabled: false,
  bankTransferEnabled: false,
  contentModerationEnabled: false,
};
