import { foldVietnamese } from "@/lib/vietnam/fold";

const MAX_BASE_LENGTH = 20;

/**
 * A readable starting point for an automatic username: the person's name
 * without accents or spaces ("Nguyễn Minh Anh" → "nguyenminhanh"), else the
 * part of their email before the @. Always matches the username rule
 * (^[a-z0-9_]+$, 3–30 characters); uniqueness is the caller's job.
 */
export function usernameBase(name: string | null | undefined, email: string) {
  const clean = (text: string) =>
    foldVietnamese(text)
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, MAX_BASE_LENGTH);
  const fromName = clean(name ?? "");
  if (fromName.length >= 3) return fromName;
  const fromEmail = clean(email.split("@")[0] ?? "");
  if (fromEmail.length >= 3) return fromEmail;
  return `user${fromName}${fromEmail}`.slice(0, MAX_BASE_LENGTH);
}

// Names a visitor would take for Fgrapher itself, or that mean something in
// a URL. A username is the public address of a profile
// (/profile/<username>); "admin" and "support" were free for anyone to take.
const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "fgrapher",
  "support",
  "hotro",
  "cskh",
  "help",
  "moderator",
  "staff",
  "official",
  "system",
  "root",
  "api",
  "login",
  "register",
  "dashboard",
  "profile",
  "settings",
  "null",
  "undefined",
]);

export function isReservedUsername(username: string) {
  return RESERVED_USERNAMES.has(username.toLowerCase());
}
