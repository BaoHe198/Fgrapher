import { foldVietnamese } from "@/lib/vietnamese-fold";

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
