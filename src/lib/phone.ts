// Vietnamese mobile numbers are entered as "090 123 4567" or "0901234567"
// almost everywhere in the product (User.phone is free text, no format
// enforced at entry) — Twilio's Verify API requires E.164 ("+84901234567").
// This is the one normalization point both lib/sms.ts's callers go through,
// so a user typing either shape gets the same verified number on file.
export function toE164VN(raw: string): string | null {
  const digits = raw.replace(/[\s.\-()]/g, "");
  if (digits.startsWith("+84") && /^\+84\d{9,10}$/.test(digits)) {
    return digits;
  }
  if (digits.startsWith("84") && /^84\d{9,10}$/.test(digits)) {
    return `+${digits}`;
  }
  // Vietnamese mobile prefixes are 10 digits starting with 0.
  if (/^0\d{9}$/.test(digits)) {
    return `+84${digits.slice(1)}`;
  }
  return null;
}
