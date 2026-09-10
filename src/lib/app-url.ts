// Canonical absolute base URL for links that leave the app — emails,
// above all, where a relative href is simply dead.
//
// NEXTAUTH_URL is deliberately optional (see lib/env.ts): on Vercel
// Preview it's meant to be unset so NextAuth infers the URL per-
// deployment from VERCEL_URL, because every Preview build gets its own
// hostname. That's correct for NextAuth and wrong for every call site
// that interpolates `process.env.NEXTAUTH_URL ?? ""` into a link — on
// Preview those produce `/reset-password?token=…` with no origin, which
// is unclickable in an inbox, or the literal string "undefined/…" when
// the `??` guard is missing entirely.
//
// This resolves the same way NextAuth itself does, so email links work
// on Preview without hardcoding a hostname anywhere.
export function getAppUrl(): string {
  const candidate =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000";

  // Trailing slashes double up once a path is appended (`…//reset-password`),
  // which some mail clients mangle when rewriting links.
  return candidate.replace(/\/+$/, "");
}

/** Absolute URL for an app-relative path, e.g. appUrl("/verify-email"). */
export function appUrl(path: string): string {
  return `${getAppUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
