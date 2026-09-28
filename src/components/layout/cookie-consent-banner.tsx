"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { OPEN_COOKIE_SETTINGS_EVENT } from "@/lib/privacy/cookie-consent";

interface CookieConsentBannerProps {
  /** The choice already stored in this browser, or null to ask. */
  initialAnalytics: boolean | null;
}

/**
 * Asks once per browser (and again whenever the privacy policy version
 * changes) whether analytics cookies may be set. The two answers carry
 * equal weight on screen: saying no must be as easy as saying yes, and
 * nothing is pre-selected (CLAUDE.md rule 6). Reopened from the footer's
 * "Cài đặt cookie" link through OPEN_COOKIE_SETTINGS_EVENT.
 */
export function CookieConsentBanner({
  initialAnalytics,
}: CookieConsentBannerProps) {
  const t = useTranslations("cookieConsent");
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [open, setOpen] = useState(initialAnalytics === null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reopen = () => {
      setError(null);
      setOpen(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
  }, []);

  if (!open) return null;

  const choose = async (allow: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/cookie-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analytics: allow }),
      });
      if (!res.ok) throw new Error("save failed");
      setAnalytics(allow);
      setOpen(false);
    } catch {
      setError(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      role="region"
      aria-label={t("regionLabel")}
      className="fixed inset-x-3 bottom-3 z-50 flex flex-col gap-3 rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-surface p-4 shadow-[var(--shadow-md)] sm:right-auto sm:left-4 sm:max-w-[440px] sm:p-5"
    >
      <h2 className="text-body-md font-semibold! text-text-primary">
        {t("title")}
      </h2>
      <p className="text-body-sm text-text-secondary">
        {t("body")}{" "}
        <Link
          href="/privacy#cookie"
          className="font-semibold! text-text-link hover:underline"
        >
          {t("details")}
        </Link>
      </p>
      {analytics !== null ? (
        <p className="text-body-sm text-text-tertiary">
          {t("currentChoice", {
            choice: analytics ? t("choiceAnalytics") : t("choiceNecessary"),
          })}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      ) : null}
      {/* Stacked at every width: side by side, the two labels do not fit the
          card and the second button spilled past its edge. */}
      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          className="w-full"
          disabled={saving}
          onClick={() => choose(false)}
        >
          {t("necessaryOnly")}
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          disabled={saving}
          onClick={() => choose(true)}
        >
          {t("allowAnalytics")}
        </Button>
      </div>
      {analytics !== null ? (
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="self-start text-body-sm text-text-secondary hover:text-text-primary"
        >
          {t("close")}
        </button>
      ) : null}
    </section>
  );
}
