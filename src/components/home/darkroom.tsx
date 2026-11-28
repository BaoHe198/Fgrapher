"use client";

import { RefreshCw, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";

import { PinButton } from "@/components/media/pin-button";
import { Button } from "@/components/ui/button";
import { shortPlace } from "@/lib/location";
import { CloudinaryImage } from "@/components/ui/cloudinary-image";
import { cn, formatCurrency } from "@/lib/utils";

// "Phòng tối" (owner, 16/11/2026): the visitor who does not know who to
// book yet develops a print. A sheet of photo paper under a red safelight
// comes up, slowly, into a real approved photo by a verified artist; the
// back of the print says who took it. Every print comes from
// /api/darkroom, which applies the same public rules as Tìm kiếm F.
// Under reduced motion the photo and the back simply appear.

interface Print {
  id: string;
  url: string;
  role: string;
  name: string | null;
  username: string;
  priceMin: number | null;
  province: string | null;
  ward: string | null;
}

type Status = "idle" | "loading" | "ready" | "empty" | "error";

const PAPER =
  "absolute inset-0 rounded-[6px] bg-[#f6f1e7] shadow-[0_30px_60px_-20px_rgb(0_0_0_/_0.8)] [backface-visibility:hidden]";

export function Darkroom() {
  const t = useTranslations("home.darkroom");
  const roleT = useTranslations("role");
  const [print, setPrint] = React.useState<Print | null>(null);
  const [status, setStatus] = React.useState<Status>("idle");
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [flipped, setFlipped] = React.useState(false);
  const [count, setCount] = React.useState(0);
  const seen = React.useRef<string[]>([]);

  const develop = async () => {
    if (status === "loading") return;
    setStatus("loading");
    setFlipped(false);
    try {
      const res = await fetch(
        `/api/darkroom?exclude=${seen.current.slice(-40).join(",")}`,
        { cache: "no-store" },
      );
      const body = (await res.json()) as { data: Print | null };
      if (!res.ok) throw new Error("failed");
      if (!body.data) {
        setStatus("empty");
        return;
      }
      seen.current.push(body.data.id);
      setImageLoaded(false);
      setPrint(body.data);
      setCount((value) => value + 1);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  const name = print?.name ?? t("unnamed");
  const place = print
    ? shortPlace([print.ward, print.province].filter(Boolean).join(", "))
    : "";
  const busy = status === "loading" || (status === "ready" && !imageLoaded);

  return (
    <section
      aria-labelledby="home-darkroom"
      className="relative mt-20 overflow-hidden bg-[#0b0908] text-white max-md:mt-12"
    >
      {/* The safelight. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_72%_40%,rgb(200_32_20_/_0.5),transparent_70%)]"
      />
      <div className="relative mx-auto grid max-w-[1440px] items-center gap-12 px-8 py-20 max-lg:grid-cols-1 max-md:gap-8 max-md:px-5 max-md:py-12 lg:grid-cols-[5fr_7fr]">
        <div className="flex flex-col gap-4">
          <span className="font-mono text-meta tracking-[0.14em] text-[#ff8a7a] uppercase">
            {t("eyebrow")}
          </span>
          <h2
            id="home-darkroom"
            className="max-w-md text-display-lg text-white max-md:text-display-md"
          >
            {t("title")}
          </h2>
          <p className="max-w-md text-body-lg text-white/75 max-md:text-body-md">
            {t("sub")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <Button
              variant="accent"
              size="lg"
              onClick={develop}
              disabled={busy}
            >
              <RefreshCw
                aria-hidden
                className={cn("size-4", busy && "animate-spin")}
              />
              {busy ? t("developing") : count > 0 ? t("another") : t("develop")}
            </Button>
            {count > 0 ? (
              <span className="font-mono text-meta tracking-[0.08em] text-white/60 uppercase">
                {t("count", { count })}
              </span>
            ) : null}
          </div>
          <p role="status" className="min-h-5 text-body-sm text-[#ffb4a8]">
            {status === "empty"
              ? t("empty")
              : status === "error"
                ? t("error")
                : ""}
          </p>
        </div>

        {/* The print: a front (the photo) and a back (who took it). */}
        <div className="mx-auto w-full max-w-[380px] [perspective:1400px] max-md:max-w-[300px]">
          <div
            className={cn(
              "relative aspect-[4/5] w-full transition-transform duration-700 ease-fg-out [transform-style:preserve-3d] motion-reduce:transition-none",
              flipped
                ? "[transform:rotateY(180deg)_rotate(2deg)]"
                : "[transform:rotate(-2deg)]",
            )}
          >
            <div className={cn(PAPER, "flex flex-col p-3 pb-12")}>
              <div className="relative flex-1 overflow-hidden bg-[#e9e2d3]">
                {print ? (
                  <CloudinaryImage
                    // A new key restarts the developing animation.
                    key={print.id}
                    src={print.url}
                    alt={t("photoAlt", { name })}
                    fill
                    sizes="380px"
                    onLoad={() => setImageLoaded(true)}
                    onError={() => {
                      setImageLoaded(true);
                      setStatus("error");
                    }}
                    className={cn(
                      "object-cover",
                      imageLoaded ? "animate-darkroom-develop" : "opacity-0",
                    )}
                  />
                ) : null}
                {print && imageLoaded ? (
                  <PinButton
                    mediaId={print.id}
                    variant="onPhoto"
                    className="absolute top-2 right-2"
                  />
                ) : null}
                {print ? null : (
                  <span className="absolute inset-0 grid place-content-center px-6 text-center font-mono text-meta tracking-[0.12em] text-[#9a917e] uppercase">
                    {t("blank")}
                  </span>
                )}
              </div>
              {print && imageLoaded ? (
                <button
                  type="button"
                  onClick={() => setFlipped(true)}
                  tabIndex={flipped ? -1 : 0}
                  className="focus-ring absolute inset-x-3 bottom-2 flex h-8 items-center justify-between gap-3 rounded-[4px] text-body-sm font-semibold text-[#3b352a]"
                >
                  <span className="truncate">{name}</span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-[#8a5a12]">
                    <RotateCcw aria-hidden className="size-3.5" />
                    {t("flip")}
                  </span>
                </button>
              ) : null}
            </div>

            <div
              aria-hidden={!flipped}
              className={cn(
                PAPER,
                "flex flex-col justify-between p-6 text-[#2a251c] [transform:rotateY(180deg)]",
              )}
            >
              {print ? (
                <>
                  <div className="flex flex-col gap-2">
                    <span className="font-mono text-meta tracking-[0.12em] text-[#8a8170] uppercase">
                      {t("shotBy")}
                    </span>
                    <strong className="font-display text-[1.75rem] leading-[1.15] font-semibold break-words">
                      {name}
                    </strong>
                    <span className="text-body-md text-[#5c5547]">
                      {[roleT(print.role), place].filter(Boolean).join(" · ")}
                    </span>
                    <span className="mt-2 text-body-lg font-semibold tabular-nums">
                      {print.priceMin
                        ? t("from", { price: formatCurrency(print.priceMin) })
                        : t("askPrice")}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="accent"
                      nativeButton={false}
                      tabIndex={flipped ? 0 : -1}
                      render={
                        <Link
                          href={`/profile/${print.username}`}
                          data-shutter
                        />
                      }
                    >
                      {t("viewProfile")}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setFlipped(false)}
                      tabIndex={flipped ? 0 : -1}
                      className="focus-ring h-9 rounded-[4px] text-body-sm font-semibold text-[#5c5547]"
                    >
                      {t("flipBack")}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
