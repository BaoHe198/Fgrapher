"use client";

import { Bell, Copy, Loader2, ShieldAlert, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { startTransition, useEffect, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

import { ResponsiveSheet } from "./responsive-sheet";

interface SyncSheetProps {
  onOpenChange: (open: boolean) => void;
}

/**
 * How the provider gets reminded. Two honest halves:
 *  - what Fgrapher does by itself — a summary the evening before and one in
 *    the morning (the hosting plan runs timed jobs once a day, so it cannot
 *    ring an hour ahead);
 *  - what the phone can do — subscribe its own calendar to the schedule, and
 *    alert at the exact time. The address is a secret, so it is created on
 *    request, can be replaced, and says plainly what it exposes.
 */
export function SyncSheet({ onOpenChange }: SyncSheetProps) {
  const t = useTranslations("dashboardCore.calendar.v2.syncSheet");
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmingRotate, setConfirmingRotate] = useState(false);

  useEffect(() => {
    fetch("/api/calendar/feed")
      .then((res) => res.json())
      .then((body) => {
        startTransition(() => {
          setUrl(body.data?.url ?? null);
          setLoading(false);
        });
      })
      .catch(() => startTransition(() => setLoading(false)));
  }, []);

  const call = async (method: "POST" | "DELETE", done: string) => {
    setBusy(true);
    const res = await fetch("/api/calendar/feed", { method }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setBusy(false);
    setConfirmingRotate(false);
    if (!res?.ok) {
      toast.add({ title: body?.message ?? t("failed"), type: "error" });
      return;
    }
    setUrl(body.data?.url ?? null);
    toast.add({ title: done, type: "success" });
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.add({ title: t("copied"), type: "success" });
    } catch {
      // Clipboard access can be refused; the address is on screen to select.
    }
  };

  return (
    <ResponsiveSheet open onOpenChange={onOpenChange} title={t("title")}>
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2">
          <h3 className="flex items-center gap-2 text-body-md font-semibold! text-text-primary">
            <Bell aria-hidden className="size-4" />
            {t("digestTitle")}
          </h3>
          <p className="text-body-sm text-text-secondary">{t("digestBody")}</p>
          <Link
            href="/dashboard/settings/notifications"
            className="focus-ring -my-2 w-fit rounded-[4px] py-2 text-body-sm font-semibold! text-text-link hover:underline"
          >
            {t("digestSettings")}
          </Link>
        </section>

        <section className="flex flex-col gap-3 border-t border-border-subtle pt-5">
          <h3 className="flex items-center gap-2 text-body-md font-semibold! text-text-primary">
            <Smartphone aria-hidden className="size-4" />
            {t("phoneTitle")}
          </h3>
          <p className="text-body-sm text-text-secondary">{t("phoneBody")}</p>

          {loading ? (
            <Skeleton className="h-11 w-full" />
          ) : url ? (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-body-sm font-semibold! text-text-primary">
                  {t("addressLabel")}
                </span>
                <div className="flex items-stretch gap-2">
                  <code className="min-w-0 flex-1 rounded-[var(--fg-radius-md)] border border-border-default bg-bg-sunken px-3 py-2.5 font-mono text-meta break-all text-text-primary select-all">
                    {url}
                  </code>
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label={t("copy")}
                    title={t("copy")}
                    onClick={copy}
                    className="size-11 shrink-0"
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>

              <a
                href={url.replace(/^https?:/, "webcal:")}
                className={cn(
                  buttonVariants({ variant: "accent" }),
                  "min-h-11",
                )}
              >
                {t("openApple")}
              </a>
              <ul className="flex list-disc flex-col gap-2 pl-5 text-body-sm text-text-secondary">
                <li>{t("appleNote")}</li>
                <li>{t("googleSteps")}</li>
                <li>{t("googleNote")}</li>
              </ul>

              <p className="flex items-start gap-2 rounded-[var(--fg-radius-md)] bg-warning-bg p-3 text-body-sm text-text-primary">
                <ShieldAlert
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-warning"
                />
                {t("secret")}
              </p>

              {confirmingRotate ? (
                <div className="flex flex-col gap-2">
                  <p className="text-body-sm text-text-primary">
                    {t("rotateConfirm")}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      disabled={busy}
                      onClick={() => setConfirmingRotate(false)}
                    >
                      {t("cancel")}
                    </Button>
                    <Button
                      variant="secondary"
                      className="flex-1"
                      disabled={busy}
                      onClick={() => call("POST", t("rotated"))}
                    >
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : null}
                      {t("rotate")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => setConfirmingRotate(true)}
                    className="min-h-10"
                  >
                    {t("rotate")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => call("DELETE", t("disabled"))}
                    className="min-h-10 text-danger"
                  >
                    {t("disable")}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="flex items-start gap-2 rounded-[var(--fg-radius-md)] bg-bg-sunken p-3 text-body-sm text-text-secondary">
                <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                {t("secret")}
              </p>
              <Button
                variant="accent"
                disabled={busy}
                onClick={() => call("POST", t("created"))}
                className="min-h-11"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {t("enable")}
              </Button>
            </>
          )}
        </section>
      </div>
    </ResponsiveSheet>
  );
}
