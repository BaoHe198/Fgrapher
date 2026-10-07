"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { buildMediaVariants } from "@/lib/media/variants";
import { cn } from "@/lib/utils";

export interface StoryFrame {
  src: string | null;
  width: number | null;
  height: number | null;
  label: string;
  alt: string;
}

export interface StoryChapter {
  /** Index into `frames` of the photo this chapter shows. */
  frame: number;
  eyebrow: string;
  problem: string;
  answer: string;
}

interface AboutStoryProps {
  frames: StoryFrame[];
  chapters: StoryChapter[];
}

// "Cách Fgrapher làm việc" (wave 2, About): four chapters scroll on the
// left while a contact sheet stays pinned on the right; the chapter in the
// middle of the screen picks its frame (gold ring) and that photo develops
// on the stage below. Phones get the sheet pinned under the header and a
// photo inside each chapter instead. Photos are always contained, never
// cropped - the ratios on the sheet are the real ones.
export function AboutStory({ frames, chapters }: AboutStoryProps) {
  const t = useTranslations("publicPages.about.story");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = listRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting)
            setActive(Number((entry.target as HTMLElement).dataset.chapter));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    root
      .querySelectorAll("[data-chapter]")
      .forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const picked = chapters[active]?.frame ?? 0;
  const stage = frames[picked];

  const sheet = (compact: boolean) => (
    <div
      role="img"
      aria-label={t("sheetLabel", { frame: frames[picked]?.label ?? "" })}
      className="grid grid-cols-12 gap-0.5 bg-border-subtle p-0.5"
    >
      {frames.map((frame, index) => (
        <div
          key={frame.label}
          className={cn("relative aspect-square bg-bg-sunken")}
        >
          {frame.src ? (
            <Image
              src={buildMediaVariants(frame.src).thumbnail}
              alt=""
              fill
              unoptimized
              sizes="80px"
              className={cn("object-contain", !compact && "p-[3px]")}
            />
          ) : null}
          {index === picked ? (
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-px rounded-full border-2 border-gold-600 dark:border-gold-400"
            />
          ) : null}
        </div>
      ))}
    </div>
  );

  return (
    <div ref={listRef}>
      {/* Desktop: chapters left, pinned sheet + stage right. */}
      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start gap-[clamp(40px,5vw,80px)] max-lg:hidden">
        <div className="flex flex-col">
          {chapters.map((chapter, index) => (
            <article
              key={chapter.eyebrow}
              data-chapter={index}
              className="flex min-h-[min(88vh,860px)] flex-col justify-center gap-5 py-10"
            >
              <ChapterText chapter={chapter} />
            </article>
          ))}
        </div>
        <div className="sticky top-[84px] flex h-[min(calc(100vh-116px),780px)] min-h-[520px] flex-col gap-3.5">
          {sheet(false)}
          <p className="flex justify-between font-mono text-meta tracking-[0.12em] text-text-tertiary uppercase">
            <span>{chapters[active]?.eyebrow}</span>
            <span>{t("count", { n: active + 1 })}</span>
          </p>
          <div className="relative grid min-h-0 flex-1 place-items-center border border-border-subtle bg-bg-sunken">
            {stage?.src ? (
              // `fill` + contain inside a 24px inset: the stage has a fixed
              // height, so percentage max-sizes on a plain <img> overflowed.
              <div className="absolute inset-6">
                <Image
                  // A new key re-runs the develop for each chapter's photo.
                  key={stage.src}
                  src={buildMediaVariants(stage.src).medium}
                  alt={stage.alt}
                  fill
                  unoptimized
                  sizes="(min-width: 1024px) 55vw, 100vw"
                  className="animate-develop object-contain"
                />
              </div>
            ) : (
              <span aria-hidden className="absolute inset-6 bg-border-subtle" />
            )}
          </div>
        </div>
      </div>

      {/* Phones and tablets: sheet pinned under the header, photo per chapter. */}
      <div className="lg:hidden">
        <div
          aria-hidden
          className="sticky top-[72px] z-[5] -mx-5 border-b border-border-subtle bg-bg-page px-5 py-2.5"
        >
          {sheet(true)}
        </div>
        <div className="flex flex-col gap-14 pt-6">
          {chapters.map((chapter, index) => {
            const frame = frames[chapter.frame];
            return (
              <article
                key={chapter.eyebrow}
                data-chapter={index}
                className="flex flex-col gap-4"
              >
                <span className="font-mono text-meta tracking-[0.12em] text-gold-600 uppercase dark:text-gold-400">
                  {chapter.eyebrow}
                </span>
                <div className="grid aspect-square place-items-center border border-border-subtle bg-bg-sunken p-3">
                  {frame?.src ? (
                    <Image
                      src={buildMediaVariants(frame.src).medium}
                      alt={frame.alt}
                      width={frame.width ?? 1200}
                      height={frame.height ?? 900}
                      unoptimized
                      loading="lazy"
                      className="max-h-full w-auto max-w-full object-contain"
                    />
                  ) : (
                    <span aria-hidden className="size-full bg-border-subtle" />
                  )}
                </div>
                <ChapterText chapter={chapter} hideEyebrow />
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ChapterText({
  chapter,
  hideEyebrow = false,
}: {
  chapter: StoryChapter;
  hideEyebrow?: boolean;
}) {
  const t = useTranslations("publicPages.about.story");
  return (
    <>
      {hideEyebrow ? null : (
        <span className="font-mono text-meta tracking-[0.12em] text-gold-600 uppercase dark:text-gold-400">
          {chapter.eyebrow}
        </span>
      )}
      <div className="flex flex-col gap-2">
        <span className="text-caption-upper text-text-tertiary">
          {t("problem")}
        </span>
        <h3 className="font-display text-[clamp(1.375rem,2.2vw,2rem)] leading-[1.2] font-medium tracking-[-0.015em] text-pretty text-text-secondary">
          {chapter.problem}
        </h3>
      </div>
      <div className="flex flex-col gap-2 border-t border-border-subtle pt-5">
        <span className="text-caption-upper text-text-tertiary">
          {t("answer")}
        </span>
        <p className="text-[17px] leading-[1.55] text-pretty text-text-primary lg:text-[19px]">
          {chapter.answer}
        </p>
      </div>
    </>
  );
}
