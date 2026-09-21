// Hosts Zalo itself hands out. zalo.me/chat.zalo.me come from "share my
// profile"; zaloapp.com/qr/... is what the QR code in the app encodes, and
// it is handed out over plain http — that link is upgraded rather than
// rejected (project owner, 21/09/2026: pasting the QR link is what people
// actually do).
const ALLOWED_ZALO_HOSTS = new Set([
  "zalo.me",
  "chat.zalo.me",
  "qr.zalo.me",
  "zaloapp.com",
]);

/**
 * Accept only links hosted by Zalo, normalised to HTTPS. Providers paste the
 * contact/share/QR link created by their Zalo app; Fgrapher does not try to
 * derive an account link from a phone number.
 */
export function normalizeZaloUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    // A bare "zalo.me/xxx" has no protocol for URL() to parse.
    const url = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const hostname = url.hostname.replace(/^www\./, "");
    if (
      !ALLOWED_ZALO_HOSTS.has(hostname) ||
      url.username ||
      url.password ||
      url.port
    ) {
      return null;
    }
    // Zalo serves every one of these over HTTPS; the QR link's http:// is
    // only what the encoder wrote.
    url.protocol = "https:";
    url.hostname = hostname;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function isValidZaloUrl(value: string) {
  return value.trim() === "" || normalizeZaloUrl(value) !== null;
}
