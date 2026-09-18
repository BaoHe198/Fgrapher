const ALLOWED_ZALO_HOSTS = new Set(["zalo.me", "chat.zalo.me"]);

/**
 * Accept only HTTPS links hosted by Zalo. Providers paste the contact/share
 * link created by their Zalo app; Fgrapher does not try to derive an account
 * link from a phone number.
 */
export function normalizeZaloUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (
      url.protocol !== "https:" ||
      !ALLOWED_ZALO_HOSTS.has(url.hostname) ||
      url.username ||
      url.password ||
      url.port
    ) {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function isValidZaloUrl(value: string) {
  return value.trim() === "" || normalizeZaloUrl(value) !== null;
}
