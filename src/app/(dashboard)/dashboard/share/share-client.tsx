"use client";

import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Copy,
  Download,
  ExternalLink,
  Printer,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { FgImage } from "@/components/ui/fg-image";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export interface ReadinessItem {
  key:
    | "published"
    | "verified"
    | "prices"
    | "hours"
    | "policies"
    | "photos"
    | "cover";
  done: boolean;
  href: string;
}

interface ShareClientProps {
  /** Absolute link; null until the account has a username. */
  link: string | null;
  pagePath: string | null;
  host: string;
  displayName: string;
  roleLabel: string;
  place: string | null;
  coverImage: string | null;
  previewFacts: string[];
  readiness: ReadinessItem[];
}

// Brand colours as plain hex for the canvas, which cannot read CSS
// variables: --green-900, --gold-400 and --gold-50 from globals.css
// (the Sentry-derived ink, accent purple and near-white since 17/11/2026).
const INK = "#1f1633";
const GOLD = "#6a5fc1";
const CREAM = "#fbf8ff";

const PLATFORMS = ["tiktok", "facebook", "instagram", "zalo"] as const;
type Platform = (typeof PLATFORMS)[number];

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/png",
    ),
  );
}

/** Largest font size (down to `min`) at which `text` fits in `width`. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  family: string,
  weight: number,
  start: number,
  min: number,
  width: number,
) {
  let size = start;
  for (; size > min; size -= 4) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= width) break;
  }
  ctx.font = `${weight} ${size}px ${family}`;
  return size;
}

export function ShareClient({
  link,
  pagePath,
  host,
  displayName,
  roleLabel,
  place,
  coverImage,
  previewFacts,
  readiness,
}: ShareClientProps) {
  const t = useTranslations("dashboardCore.share");
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState<"qr" | "card" | null>(null);

  useEffect(() => {
    if (!link) return;
    let cancelled = false;
    QRCode.toDataURL(link, {
      width: 480,
      margin: 1,
      color: { dark: INK, light: "#ffffff" },
    }).then((url) => {
      if (!cancelled) setQr(url);
    });
    return () => {
      cancelled = true;
    };
  }, [link]);

  const copy = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.add({ title: message, type: "success" });
    } catch {
      toast.add({ title: t("copyFailed"), type: "error" });
    }
  };

  const downloadQr = async () => {
    if (!link) return;
    setBusy("qr");
    try {
      const canvas = document.createElement("canvas");
      await QRCode.toCanvas(canvas, link, {
        width: 1024,
        margin: 2,
        color: { dark: INK, light: "#ffffff" },
      });
      download(await canvasBlob(canvas), "fgrapher-qr.png");
    } catch {
      toast.add({ title: t("downloadFailed"), type: "error" });
    } finally {
      setBusy(null);
    }
  };

  // A 1080x1350 card (a phone story / a print at 9x11 cm): name, role and
  // place, the QR code, and what scanning it does. Drawn on a canvas in the
  // browser - nothing is sent anywhere to make it.
  const downloadCard = async () => {
    if (!link) return;
    setBusy("card");
    try {
      await document.fonts?.ready;
      const W = 1080;
      const H = 1350;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      const styles = getComputedStyle(document.body);
      const display =
        styles.getPropertyValue("--font-display").trim() || "sans-serif";
      const body =
        styles.getPropertyValue("--font-body").trim() || "sans-serif";

      ctx.fillStyle = INK;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 3;
      ctx.strokeRect(40, 40, W - 80, H - 80);

      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = GOLD;
      ctx.font = `600 30px ${body}`;
      ctx.fillText("FGRAPHER", W / 2, 140);

      ctx.fillStyle = CREAM;
      fitFont(ctx, displayName, display, 600, 96, 48, W - 200);
      ctx.fillText(displayName, W / 2, 260);

      ctx.fillStyle = GOLD;
      const sub = [roleLabel, place].filter(Boolean).join(" · ");
      fitFont(ctx, sub, body, 500, 38, 24, W - 200);
      ctx.fillText(sub, W / 2, 330);

      const qrCanvas = document.createElement("canvas");
      await QRCode.toCanvas(qrCanvas, link, {
        width: 560,
        margin: 2,
        color: { dark: INK, light: "#ffffff" },
      });
      const box = 620;
      const bx = (W - box) / 2;
      const by = 400;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(bx, by, box, box, 36);
      ctx.fill();
      ctx.drawImage(qrCanvas, bx + 30, by + 30, 560, 560);

      ctx.fillStyle = CREAM;
      fitFont(ctx, t("card.scan"), display, 600, 52, 32, W - 200);
      ctx.fillText(t("card.scan"), W / 2, 1120);

      ctx.fillStyle = GOLD;
      const shortLink = link.replace(/^https?:\/\//, "");
      fitFont(ctx, shortLink, body, 500, 34, 22, W - 200);
      ctx.fillText(shortLink, W / 2, 1190);

      download(await canvasBlob(canvas), "fgrapher-the-dat-lich.png");
    } catch {
      toast.add({ title: t("downloadFailed"), type: "error" });
    } finally {
      setBusy(null);
    }
  };

  const doneCount = readiness.filter((item) => item.done).length;
  const caption = (platform: Platform) =>
    link ? t(`platforms.${platform}.caption`, { link }) : "";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-display-md text-text-primary">{t("title")}</h1>
        <p className="max-w-[640px] text-body-md text-text-secondary">
          {t("intro")}
        </p>
      </div>

      {!link ? (
        <div className="flex flex-col items-start gap-3 rounded-[var(--fg-radius-lg)] border border-gold-400 bg-gold-50 p-5 dark:border-gold-700 dark:bg-gold-900/30">
          <p className="text-body-md text-text-primary">{t("noUsername")}</p>
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href="/dashboard/settings/profile" />}
          >
            {t("setUsername")}
          </Button>
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
          <div className="flex min-w-0 flex-col gap-6">
            <section
              aria-labelledby="share-link"
              className="flex flex-col gap-4 rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-surface p-5"
            >
              <div className="flex flex-col gap-1">
                <h2
                  id="share-link"
                  className="text-heading-md text-text-primary"
                >
                  {t("link.title")}
                </h2>
                <p className="text-body-sm text-text-secondary">
                  {t("link.body")}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  readOnly
                  value={link}
                  aria-label={t("link.title")}
                  onFocus={(e) => e.currentTarget.select()}
                  className="focus-ring h-11 min-w-0 flex-1 rounded-[var(--fg-radius-md)] border border-border-subtle bg-bg-sunken px-3 font-mono text-body-sm text-text-primary"
                />
                <Button
                  variant="accent"
                  onClick={() => copy(link, t("link.copied"))}
                >
                  <Copy className="size-4" />
                  {t("link.copy")}
                </Button>
                {pagePath ? (
                  <Button
                    variant="outline"
                    nativeButton={false}
                    render={
                      <a href={pagePath} target="_blank" rel="noreferrer" />
                    }
                  >
                    <ExternalLink className="size-4" />
                    {t("link.open")}
                  </Button>
                ) : null}
              </div>
              <ol className="grid gap-2 text-body-sm text-text-secondary sm:grid-cols-3">
                {(["one", "two", "three"] as const).map((step, index) => (
                  <li
                    key={step}
                    className="flex gap-2 rounded-[var(--fg-radius-md)] bg-bg-sunken px-3 py-2.5"
                  >
                    <span className="font-semibold! text-gold-700 tabular-nums dark:text-gold-300">
                      {index + 1}
                    </span>
                    {t(`link.flow.${step}`)}
                  </li>
                ))}
              </ol>
            </section>

            <section
              aria-labelledby="share-where"
              className="flex flex-col gap-4 rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-surface p-5"
            >
              <div className="flex flex-col gap-1">
                <h2
                  id="share-where"
                  className="text-heading-md text-text-primary"
                >
                  {t("where.title")}
                </h2>
                <p className="text-body-sm text-text-secondary">
                  {t("where.body")}
                </p>
              </div>
              <Tabs defaultValue="tiktok">
                <TabsList>
                  {PLATFORMS.map((platform) => (
                    <TabsTab key={platform} value={platform}>
                      {t(`platforms.${platform}.name`)}
                    </TabsTab>
                  ))}
                </TabsList>
                {PLATFORMS.map((platform) => (
                  <TabsPanel
                    key={platform}
                    value={platform}
                    className="flex flex-col gap-4 pt-4"
                  >
                    <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-body-sm text-text-primary marker:font-semibold marker:text-text-tertiary">
                      {(["step1", "step2", "step3"] as const).map((step) => (
                        <li key={step}>{t(`platforms.${platform}.${step}`)}</li>
                      ))}
                    </ol>
                    <div className="flex flex-col gap-2">
                      <span className="text-meta font-semibold! tracking-[0.04em] text-text-secondary uppercase">
                        {t("where.captionLabel")}
                      </span>
                      <p className="rounded-[var(--fg-radius-md)] border border-border-subtle bg-bg-sunken px-3.5 py-3 text-body-sm whitespace-pre-line [overflow-wrap:anywhere] text-text-primary">
                        {caption(platform)}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="self-start"
                        onClick={() =>
                          copy(caption(platform), t("where.captionCopied"))
                        }
                      >
                        <Copy className="size-4" />
                        {t("where.copyCaption")}
                      </Button>
                    </div>
                  </TabsPanel>
                ))}
              </Tabs>
            </section>

            <section
              aria-labelledby="share-ready"
              className="flex flex-col gap-4 rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-surface p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2
                  id="share-ready"
                  className="text-heading-md text-text-primary"
                >
                  {t("ready.title")}
                </h2>
                <span className="text-body-sm font-semibold! tabular-nums text-text-secondary">
                  {t("ready.count", {
                    done: doneCount,
                    total: readiness.length,
                  })}
                </span>
              </div>
              <p className="text-body-sm text-text-secondary">
                {t("ready.body")}
              </p>
              <ul className="flex flex-col divide-y divide-border-subtle">
                {readiness.map((item) => (
                  <li
                    key={item.key}
                    className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="flex items-start gap-2.5">
                      {item.done ? (
                        <CheckCircle2
                          aria-hidden
                          className="mt-0.5 size-4 shrink-0 text-success"
                        />
                      ) : (
                        <Circle
                          aria-hidden
                          className="mt-0.5 size-4 shrink-0 text-text-tertiary"
                        />
                      )}
                      <span className="flex flex-col">
                        <span
                          className={cn(
                            "text-body-sm font-semibold!",
                            item.done
                              ? "text-text-secondary"
                              : "text-text-primary",
                          )}
                        >
                          {t(`ready.items.${item.key}.label`)}
                          <span className="sr-only">
                            {" "}
                            {item.done ? t("ready.doneSr") : t("ready.todoSr")}
                          </span>
                        </span>
                        {item.done ? null : (
                          <span className="text-meta text-text-tertiary">
                            {t(`ready.items.${item.key}.why`)}
                          </span>
                        )}
                      </span>
                    </span>
                    {item.done ? null : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 self-start sm:self-auto"
                        nativeButton={false}
                        render={<Link href={item.href} />}
                      >
                        {t(`ready.items.${item.key}.action`)}
                        <ArrowRight className="size-4" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="flex flex-col gap-6 lg:sticky lg:top-24">
            <section
              aria-labelledby="share-qr"
              className="flex flex-col items-center gap-4 rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-surface p-5"
            >
              <h2
                id="share-qr"
                className="self-start text-heading-md text-text-primary"
              >
                {t("qr.title")}
              </h2>
              <div className="w-full rounded-[var(--fg-radius-lg)] bg-green-900 p-5 text-center">
                <p className="text-meta font-semibold! tracking-[0.14em] text-gold-300 uppercase">
                  Fgrapher
                </p>
                <p className="mt-1 truncate font-display text-heading-lg text-gold-50">
                  {displayName}
                </p>
                <p className="truncate text-meta text-gold-300">
                  {[roleLabel, place].filter(Boolean).join(" · ")}
                </p>
                <div className="mx-auto mt-4 aspect-square w-full max-w-[220px] rounded-[var(--fg-radius-md)] bg-white p-3">
                  {qr ? (
                    // A client-generated data: URL; nothing for next/image
                    // to optimise.
                    <img
                      src={qr}
                      alt={t("qr.alt", { name: displayName })}
                      width={196}
                      height={196}
                      className="size-full"
                    />
                  ) : (
                    <div className="size-full animate-pulse rounded bg-bg-sunken" />
                  )}
                </div>
                <p className="mt-4 text-body-sm font-semibold! text-gold-50">
                  {t("card.scan")}
                </p>
              </div>
              <div className="flex w-full flex-col gap-2">
                <Button
                  variant="accent"
                  className="w-full"
                  disabled={busy !== null}
                  onClick={downloadCard}
                >
                  <Printer className="size-4" />
                  {busy === "card" ? t("qr.working") : t("qr.downloadCard")}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={busy !== null}
                  onClick={downloadQr}
                >
                  <Download className="size-4" />
                  {busy === "qr" ? t("qr.working") : t("qr.downloadQr")}
                </Button>
              </div>
              <p className="text-meta text-text-tertiary">{t("qr.hint")}</p>
            </section>

            <section
              aria-labelledby="share-preview"
              className="flex flex-col gap-3 rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-surface p-5"
            >
              <div className="flex flex-col gap-1">
                <h2
                  id="share-preview"
                  className="text-heading-md text-text-primary"
                >
                  {t("preview.title")}
                </h2>
                <p className="text-meta text-text-tertiary">
                  {t("preview.body")}
                </p>
              </div>
              <div className="flex flex-col gap-1.5 self-end">
                <span className="max-w-[260px] self-end rounded-2xl rounded-br-sm bg-[#0068ff] px-3.5 py-2 text-body-sm [overflow-wrap:anywhere] text-white">
                  {link}
                </span>
                <div className="w-[260px] self-end overflow-hidden rounded-2xl border border-border-subtle bg-bg-page">
                  <div className="aspect-[1.91/1] bg-bg-sunken">
                    {coverImage ? (
                      // The same photo the chat app fetches as og:image.
                      <FgImage
                        src={coverImage}
                        alt=""
                        rounded="none"
                        reveal={false}
                        sizes="260px"
                        className="size-full"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center px-4 text-center text-meta text-text-tertiary">
                        {t("preview.noCover")}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5 px-3 py-2.5">
                    <span className="line-clamp-2 text-body-sm font-semibold! text-text-primary">
                      {t("preview.headline", {
                        name: displayName,
                        role: roleLabel,
                      })}
                    </span>
                    <span className="line-clamp-2 text-meta text-text-secondary">
                      {previewFacts.length > 0
                        ? previewFacts.join(" · ")
                        : t("preview.cta")}
                    </span>
                    <span className="text-meta text-text-tertiary">{host}</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
