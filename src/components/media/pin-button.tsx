"use client";

import { Pin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { cn } from "@/lib/utils";

// Pins one photo to the visitor's "Bảng ý tưởng". Every pin button on a
// page shares one copy of the board's ids (fetched once per page load, for
// signed-in visitors only), so pinning in the lightbox shows at once on
// the same photo elsewhere. A signed-out visitor is sent to sign in and
// comes back to the page they were on.

let pinned: Set<string> | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function loadPinned() {
  loading ??= fetch("/api/moodboard")
    .then((res) => (res.ok ? res.json() : { data: [] }))
    .then((body: { data: string[] | null }) => {
      pinned = new Set(body.data ?? []);
      notify();
    })
    .catch(() => {
      pinned = new Set();
    });
  return loading;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

interface PinButtonProps {
  mediaId: string;
  /** "onPhoto": a round button over a photo. "inline": a text button. */
  variant?: "onPhoto" | "inline";
  className?: string;
}

export function PinButton({
  mediaId,
  variant = "inline",
  className,
}: PinButtonProps) {
  const t = useTranslations("sharedComponents.pinButton");
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const isPinned = React.useSyncExternalStore(
    subscribe,
    () => pinned?.has(mediaId) ?? false,
    () => false,
  );

  React.useEffect(() => {
    if (status === "authenticated") void loadPinned();
  }, [status]);

  const toggle = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (status !== "authenticated") {
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
      return;
    }
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const next = !isPinned;
    try {
      await loadPinned();
      const res = await fetch("/api/moodboard", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId }),
      });
      if (!res.ok) throw new Error("failed");
      if (next) pinned?.add(mediaId);
      else pinned?.delete(mediaId);
      notify();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const label = failed ? t("failed") : isPinned ? t("pinned") : t("pin");

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={isPinned}
      aria-label={variant === "onPhoto" ? label : undefined}
      title={variant === "onPhoto" ? label : undefined}
      className={cn(
        "focus-ring inline-flex shrink-0 items-center justify-center gap-1.5 font-semibold transition-colors duration-[var(--fg-dur-150)] disabled:opacity-60",
        variant === "onPhoto"
          ? "size-10 rounded-full bg-black/55 text-white backdrop-blur hover:bg-black/75"
          : "h-9 rounded-[var(--fg-radius-sm)] border border-border-default bg-bg-surface px-3 text-body-sm text-text-primary hover:bg-bg-sunken",
        isPinned &&
          (variant === "onPhoto"
            ? "bg-gold-400 text-white hover:bg-gold-500"
            : "border-gold-500 bg-gold-50 text-neutral-900 dark:bg-gold-900/30 dark:text-gold-100"),
        failed && "text-danger",
        className,
      )}
    >
      <Pin aria-hidden className={cn("size-4", isPinned && "fill-current")} />
      {variant === "inline" ? <span aria-live="polite">{label}</span> : null}
    </button>
  );
}
