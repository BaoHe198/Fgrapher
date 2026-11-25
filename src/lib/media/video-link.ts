// A portfolio video is either a file uploaded to Cloudinary or, since
// 25/11/2026, a YouTube link: a wedding film does not fit the 100MB upload
// limit, and it is on YouTube already. Both are ProfileMedia rows of type
// VIDEO; a link is told apart by its URL alone (no publicId, no new column).
//
// YouTube only, on purpose. A linked video is moderated like any other
// upload, and that only means something if what was approved is what stays
// at the address: a YouTube video cannot be swapped for another under the
// same id. Vimeo lets the owner replace the file behind a link, which would
// let a video change after it was approved.
//
// Deliberately zero imports, like variants.ts and kind.ts, so it is safe
// from either a Server or a Client Component.

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

/**
 * The video id in a YouTube link, or null for anything else. Accepts the
 * shapes people actually paste: watch?v=, youtu.be/, /shorts/, /embed/,
 * /live/, with or without tracking parameters.
 */
export function youtubeVideoId(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase();
  let id: string | null = null;
  if (host === "youtu.be") {
    id = url.pathname.split("/")[1] ?? null;
  } else if (YOUTUBE_HOSTS.has(host)) {
    const [, first, second] = url.pathname.split("/");
    if (first === "watch") id = url.searchParams.get("v");
    else if (first === "shorts" || first === "embed" || first === "live") {
      id = second ?? null;
    }
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

/** The one form a link is stored in, whatever was pasted. */
export function youtubeWatchUrl(id: string) {
  return `https://www.youtube.com/watch?v=${id}`;
}

/**
 * The player. youtube-nocookie.com sets no cookie until the visitor plays,
 * and it is the only frame source the CSP allows (next.config.ts).
 */
export function youtubeEmbedUrl(id: string, autoplay = false) {
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0${autoplay ? "&autoplay=1" : ""}`;
}

/**
 * A still frame to stand for a video in a grid: YouTube's own thumbnail,
 * or the first frame of an uploaded file, which Cloudinary renders when a
 * video's address is asked for as a .jpg. Null when neither applies.
 *
 * YouTube keeps several thumbnails. "mqdefault" (320x180) exists for every
 * video and is 16:9 like the film; "hq720" (1280x720) is sharper but
 * missing on older or low-resolution uploads, where YouTube answers with a
 * 120px grey placeholder instead of an error. Ask for `sharp` only where
 * that can be noticed and the smaller one put back (VideoTile does).
 */
export function videoPosterUrl(
  url: string,
  { width = 800, sharp = false }: { width?: number; sharp?: boolean } = {},
): string | null {
  const youtubeId = youtubeVideoId(url);
  if (youtubeId) {
    return `https://i.ytimg.com/vi/${youtubeId}/${sharp ? "hq720" : "mqdefault"}.jpg`;
  }

  const marker = "/video/upload/";
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const insertAt = index + marker.length;
  const rest = url.slice(insertAt).replace(/\.[a-z0-9]+(?=$|[?#])/i, "");
  return `${url.slice(0, insertAt)}so_0,c_limit,w_${width},q_auto/${rest}.jpg`;
}
