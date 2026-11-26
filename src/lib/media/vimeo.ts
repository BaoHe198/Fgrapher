// Server-side: what Vimeo says about a video, from its public oEmbed
// endpoint. No key, no account, and nothing about our user is sent: only
// the video's own public address.
//
// Used twice: when a provider adds a Vimeo link (a video that is gone,
// private, or has embedding turned off is refused there and then, rather
// than becoming a dead tile on their page), and for the poster frame (see
// /api/media/vimeo-poster).

export type VimeoLookup =
  | { status: "ok"; thumbnailUrl: string | null }
  /** Vimeo answered that there is nothing to embed at this address. */
  | { status: "missing" }
  /** Vimeo could not be reached; nothing is known either way. */
  | { status: "unknown" };

const TIMEOUT_MS = 5000;
// A day: a poster rarely changes, and a removed video is caught on the next
// lookup after that.
const REVALIDATE_SECONDS = 86_400;

/** Only Vimeo's own image host is ever passed on to a browser. */
function vimeoImage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".vimeocdn.com")
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export async function lookUpVimeo(
  id: string,
  hash: string | null,
): Promise<VimeoLookup> {
  if (!/^\d{6,12}$/.test(id) || (hash && !/^[0-9a-f]{6,16}$/i.test(hash))) {
    return { status: "missing" };
  }
  const video = `https://vimeo.com/${id}${hash ? `/${hash}` : ""}`;
  try {
    const res = await fetch(
      `https://vimeo.com/api/oembed.json?width=1280&url=${encodeURIComponent(video)}`,
      {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        next: { revalidate: REVALIDATE_SECONDS },
      },
    );
    // 404: no such video. 403: private, or embedding is switched off.
    if (res.status === 404 || res.status === 403) return { status: "missing" };
    if (!res.ok) return { status: "unknown" };
    const body: unknown = await res.json();
    const thumbnail =
      body && typeof body === "object" && "thumbnail_url" in body
        ? (body as { thumbnail_url: unknown }).thumbnail_url
        : null;
    return { status: "ok", thumbnailUrl: vimeoImage(thumbnail) };
  } catch {
    return { status: "unknown" };
  }
}
