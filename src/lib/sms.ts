import twilio from "twilio";

// Prompt G7 — posting a ServiceRequest requires a phone-verified account
// (anti-fake-request measure, the project owner's explicit decision over
// the weaker "just require emailVerified" alternative). Uses Twilio's
// Verify API rather than rolling our own OTP storage/hashing/expiry —
// Verify owns the whole code lifecycle on its side, so this file only
// ever starts or checks a verification, never stores a code itself.
//
// No-ops gracefully when Twilio isn't configured (this environment has no
// live credentials), matching the pattern already used for Stripe/
// Cloudinary/Resend — callers check isSmsConfigured() or catch
// SmsNotConfiguredError rather than crash.
const client =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

export function isSmsConfigured() {
  return Boolean(client && verifyServiceSid);
}

// Dev-only fallback so the phone-gated ServiceRequest flow (Prompt G7) can
// be exercised end-to-end in a sandbox with no live Twilio credentials,
// per the project owner's explicit decision. Gated on NODE_ENV, which Next.js
// itself sets — not an env var an operator could accidentally leave on in a
// deployed build — so this can never activate outside `next dev`.
export const DEV_BYPASS_CODE = "000000";

export function isDevBypassActive() {
  return process.env.NODE_ENV === "development" && !isSmsConfigured();
}

export function canVerifyPhone() {
  return isSmsConfigured() || isDevBypassActive();
}

export class SmsNotConfiguredError extends Error {
  constructor() {
    super("SMS verification isn't configured in this environment");
    this.name = "SmsNotConfiguredError";
  }
}

function requireVerifyService() {
  if (!client || !verifyServiceSid) throw new SmsNotConfiguredError();
  return client.verify.v2.services(verifyServiceSid);
}

// Starts a new verification, sending an SMS code to `phone` (E.164, e.g.
// "+84901234567"). Twilio itself rate-limits repeat sends to the same
// number.
export async function startPhoneVerification(phone: string) {
  if (isDevBypassActive()) return "pending"; // no real SMS sent — see DEV_BYPASS_CODE

  const service = requireVerifyService();
  const verification = await service.verifications.create({
    to: phone,
    channel: "sms",
  });
  return verification.status; // "pending"
}

// Returns true only when the code matches and hasn't expired/been used —
// Twilio marks the verification "approved" server-side; a repeat check
// with the same (now-consumed) code correctly returns false.
export async function checkPhoneVerification(phone: string, code: string) {
  if (isDevBypassActive()) return code === DEV_BYPASS_CODE;

  const service = requireVerifyService();
  const check = await service.verificationChecks.create({ to: phone, code });
  return check.status === "approved";
}
