// A portfolio video is either a file uploaded to Cloudinary or a link to a
// video already published elsewhere: a wedding film does not fit the 100MB
// upload limit. Both are ProfileMedia rows of type VIDEO; a link is told
// apart by its URL alone (no publicId, no new column).
//
// YouTube since 25/11/2026, Vimeo since 26/11/2026.
//
// The two are not equal for moderation. A linked video is reviewed like any
// upload, and that only means something if what was approved is what stays
// at the address. A YouTube video cannot be swapped for another under the
// same id. Vimeo lets the owner replace the file behind a link, so a Vimeo
// video CAN change after it was approved. The project owner accepted that
// on 26/11/2026 (videographers publish on Vimeo); what stands against the
// risk is a warning on the admin's review card, the public report button,
// and a periodic re-review that is still a manual task (see the checklist
// in docs/ops). Do not treat a Vimeo link as "reviewed once, safe forever".
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

const VIMEO_ID = /^\d{6,12}$/;
// The key of an unlisted Vimeo video: the second part of vimeo.com/<id>/<key>.
const VIMEO_HASH = /^[0-9a-f]{6,16}$/i;
const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);

function parseUrl(input: string): URL | null {
  try {
    const url = new URL(input.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

/**
 * The video id in a YouTube link, or null for anything else. Accepts the
 * shapes people actually paste: watch?v=, youtu.be/, /shorts/, /embed/,
 * /live/, with or without tracking parameters.
 */
export function youtubeVideoId(input: string): string | null {
  const url = parseUrl(input);
  if (!url) return null;

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

/** The one form a YouTube link is stored in, whatever was pasted. */
export function youtubeWatchUrl(id: string) {
  return `https://www.youtube.com/watch?v=${id}`;
}

/**
 * The player. youtube-nocookie.com sets no cookie until the visitor plays,
 * and it is one of the two frame sources the CSP allows (next.config.ts).
 */
export function youtubeEmbedUrl(id: string, autoplay = false) {
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0${autoplay ? "&autoplay=1" : ""}`;
}

/**
 * The id (and, for an unlisted video, the key) in a Vimeo link, or null.
 * Accepts vimeo.com/<id>, vimeo.com/<id>/<key>, the player's /video/<id>,
 * and the longer addresses of channels, groups and showcases, which all end
 * in the video's number.
 */
export function vimeoVideo(
  input: string,
): { id: string; hash: string | null } | null {
  const url = parseUrl(input);
  if (!url || !VIMEO_HOSTS.has(url.hostname.toLowerCase())) return null;

  const parts = url.pathname.split("/").filter(Boolean);
  let at = -1;
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if (VIMEO_ID.test(parts[i])) {
      at = i;
      break;
    }
  }
  if (at === -1) return null;
  const next = parts[at + 1] ?? url.searchParams.get("h") ?? "";
  return {
    id: parts[at],
    hash: VIMEO_HASH.test(next) ? next.toLowerCase() : null,
  };
}

/** A video that lives on another site, as this app understands it. */
export type LinkedVideo =
  | { provider: "youtube"; id: string }
  | { provider: "vimeo"; id: string; hash: string | null };

/** What a pasted or stored URL links to, or null for an uploaded file. */
export function linkedVideo(input: string): LinkedVideo | null {
  const youtubeId = youtubeVideoId(input);
  if (youtubeId) return { provider: "youtube", id: youtubeId };
  const vimeo = vimeoVideo(input);
  if (vimeo) return { provider: "vimeo", ...vimeo };
  return null;
}

/** The one form a link is stored in, whatever was pasted. */
export function linkedVideoUrl(video: LinkedVideo): string {
  if (video.provider === "youtube") return youtubeWatchUrl(video.id);
  return `https://vimeo.com/${video.id}${video.hash ? `/${video.hash}` : ""}`;
}

/**
 * The player's address. Vimeo's is asked not to track (dnt=1); both hosts
 * are the only frame sources the CSP allows.
 */
export function linkedVideoEmbedUrl(video: LinkedVideo, autoplay = false) {
  if (video.provider === "youtube") return youtubeEmbedUrl(video.id, autoplay);
  return `https://player.vimeo.com/video/${video.id}?dnt=1${
    video.hash ? `&h=${video.hash}` : ""
  }${autoplay ? "&autoplay=1" : ""}`;
}

/** The site's name, for a label ("Video Vimeo"). */
export function linkedVideoProvider(video: LinkedVideo) {
  return video.provider === "youtube" ? "YouTube" : "Vimeo";
}

/**
 * A still frame to stand for a video in a grid: the site's own thumbnail
 * for a link, or the first frame of an uploaded file, which Cloudinary
 * renders when a video's address is asked for as a .jpg. Null when none
 * applies.
 *
 * YouTube keeps several thumbnails. "mqdefault" (320x180) exists for every
 * video and is 16:9 like the film; "hq720" (1280x720) is sharper but
 * missing on older or low-resolution uploads, where YouTube answers with a
 * 120px grey placeholder instead of an error. Ask for `sharp` only where
 * that can be noticed and the smaller one put back (VideoTile does).
 *
 * Vimeo has no thumbnail address that can be worked out from the id, so
 * this app's own /api/media/vimeo-poster/<id> looks it up and redirects.
 * It answers 404 for a video that is gone or private, and VideoTile then
 * draws a plain tile.
 */
export function videoPosterUrl(
  url: string,
  { width = 800, sharp = false }: { width?: number; sharp?: boolean } = {},
): string | null {
  const linked = linkedVideo(url);
  if (linked?.provider === "youtube") {
    return `https://i.ytimg.com/vi/${linked.id}/${sharp ? "hq720" : "mqdefault"}.jpg`;
  }
  if (linked?.provider === "vimeo") {
    return `/api/media/vimeo-poster/${linked.id}${
      linked.hash ? `?h=${linked.hash}` : ""
    }`;
  }

  const marker = "/video/upload/";
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const insertAt = index + marker.length;
  const rest = url.slice(insertAt).replace(/\.[a-z0-9]+(?=$|[?#])/i, "");
  return `${url.slice(0, insertAt)}so_0,c_limit,w_${width},q_auto/${rest}.jpg`;
}
