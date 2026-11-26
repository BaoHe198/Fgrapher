"use client";

import { Play } from "lucide-react";
import { useState } from "react";

import {
  linkedVideo,
  linkedVideoEmbedUrl,
  linkedVideoProvider,
  videoPosterUrl,
} from "@/lib/media/video-link";
import { cn } from "@/lib/utils";

// One place that knows a portfolio video is either an uploaded file or a
// link to YouTube or Vimeo (lib/media/video-link.ts). Every screen used to
// write its own <video src>, which a link cannot go into.

/**
 * A video standing still in a grid: its poster frame under a play mark.
 * Fills its parent, which sets the shape and handles the click. Nothing is
 * asked of YouTube here beyond the thumbnail; the player loads only where
 * the visitor opens the video.
 */
export function VideoTile({
  url,
  className,
  markClassName,
}: {
  url: string;
  className?: string;
  /** Size of the play mark; small tiles pass a smaller one. */
  markClassName?: string;
}) {
  // The sharp YouTube thumbnail first; where a video has none, YouTube
  // sends a 120px placeholder rather than an error, and the small one that
  // always exists takes its place.
  const [sharp, setSharp] = useState(true);
  // A poster that will not load: a Vimeo video that is private or gone.
  const [posterFailed, setPosterFailed] = useState(false);
  const linked = linkedVideo(url);
  const poster = posterFailed ? null : videoPosterUrl(url, { sharp });
  return (
    <span className={cn("relative block size-full bg-bg-sunken", className)}>
      {poster ? (
        // A plain <img>: the poster is YouTube's thumbnail or a frame
        // Cloudinary renders, and neither needs the image optimiser.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt=""
          loading="lazy"
          onLoad={(event) => {
            if (sharp && event.currentTarget.naturalWidth <= 120) {
              setSharp(false);
            }
          }}
          onError={() => (sharp ? setSharp(false) : setPosterFailed(true))}
          className="absolute inset-0 size-full object-cover"
        />
      ) : linked ? (
        // A link has no file to draw a frame from: a plain dark tile that
        // names the site, under the play mark.
        <span className="absolute inset-0 flex items-end justify-center bg-[#141210] pb-3 text-meta font-semibold tracking-[0.08em] text-white/70 uppercase">
          {linkedVideoProvider(linked)}
        </span>
      ) : (
        <video
          src={url}
          muted
          preload="metadata"
          className="absolute inset-0 size-full object-cover"
        />
      )}
      <PlayMark className={markClassName} />
    </span>
  );
}

/** The round play mark, centred over whatever it is drawn on. */
export function PlayMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute top-1/2 left-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white",
        className,
      )}
    >
      <Play className="size-1/2 translate-x-[6%] fill-current" />
    </span>
  );
}

/**
 * The video itself, for the places a visitor opened it on purpose (a
 * lightbox). An uploaded file plays in the browser's own player; a YouTube
 * link plays in YouTube's no-cookie player at 16:9.
 */
export function PortfolioVideoPlayer({
  url,
  title,
  autoPlay = false,
  onReady,
  className,
  frameClassName,
}: {
  url: string;
  /** Names the YouTube player for a screen reader. */
  title: string;
  autoPlay?: boolean;
  /** Fires once there is something to show. */
  onReady?: () => void;
  /** Applied to an uploaded video. */
  className?: string;
  /** Applied to a YouTube player, which needs a width of its own. */
  frameClassName?: string;
}) {
  const linked = linkedVideo(url);
  if (linked) {
    return (
      <iframe
        // Remounts when moving between two videos, so the previous one does
        // not keep playing underneath.
        key={url}
        src={linkedVideoEmbedUrl(linked, autoPlay)}
        title={title}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={onReady}
        className={cn("aspect-video border-0 bg-black", frameClassName)}
      />
    );
  }
  return (
    <video
      key={url}
      src={url}
      controls
      autoPlay={autoPlay}
      playsInline
      onLoadedData={onReady}
      className={className}
    />
  );
}
