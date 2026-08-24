"use client";

import { Check, ImageOff, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  MEDIA_MODERATION_SLA_HOURS,
  MEDIA_REJECTION_REASONS,
} from "@/lib/constants";
import { buildMediaVariants } from "@/lib/media-variants";
import { cn } from "@/lib/utils";

interface MediaRow {
  id: string;
  url: string;
  type: "IMAGE" | "VIDEO";
  createdAt: string;
  profile: {
    role: string;
    displayName: string | null;
    user: { name: string | null; firstName: string | null; email: string };
  };
}

function isOverdue(createdAt: string) {
  return (
    Date.now() - new Date(createdAt).getTime() >
    MEDIA_MODERATION_SLA_HOURS * 3_600_000
  );
}

export default function AdminModerationPage() {
  const t = useTranslations("accountFlows.admin.moderation");
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [reasonPreset, setReasonPreset] = useState("");
  const [reasonNote, setReasonNote] = useState("");
  const [showRejectPanel, setShowRejectPanel] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    startTransition(() => setIsLoading(true));
    fetch("/api/admin/moderation")
      .then((res) => res.json())
      .then((body) => {
        startTransition(() => {
          setMedia(body.data ?? []);
          setSelected(new Set());
          setFocusedIndex(0);
          setIsLoading(false);
        });
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeIds = useMemo(() => {
    if (selected.size > 0) return Array.from(selected);
    return media[focusedIndex] ? [media[focusedIndex].id] : [];
  }, [selected, media, focusedIndex]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const approve = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0 || busy) return;
      setBusy(true);
      await fetch("/api/admin/moderation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", mediaIds: ids }),
      });
      setBusy(false);
      toast.add({
        title: t("approvedToast", { count: ids.length }),
        type: "success",
      });
      load();
    },
    [busy, load, t],
  );

  const reject = async () => {
    if (activeIds.length === 0 || !reasonPreset || busy) return;
    setBusy(true);
    const reason = reasonNote.trim()
      ? `${reasonPreset} — ${reasonNote.trim()}`
      : reasonPreset;
    await fetch("/api/admin/moderation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", mediaIds: activeIds, reason }),
    });
    setBusy(false);
    setShowRejectPanel(false);
    setReasonPreset("");
    setReasonNote("");
    toast.add({
      title: t("rejectedToast", { count: activeIds.length }),
      type: "success",
    });
    load();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Never hijack keystrokes while typing in the reject-reason note.
      if (
        target.tagName === "TEXTAREA" ||
        target.tagName === "INPUT" ||
        target.tagName === "SELECT"
      )
        return;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, media.length - 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        void approve(activeIds);
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        setShowRejectPanel(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [media.length, activeIds, approve]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-display-md text-text-primary">{t("title")}</h1>
        <p className="text-body-md text-text-secondary">
          {t("description", { hours: MEDIA_MODERATION_SLA_HOURS })}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-text-tertiary" />
        </div>
      ) : media.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <ImageOff className="size-12 text-text-tertiary" />
          <p className="text-body-lg font-semibold text-text-primary">
            {t("empty")}
          </p>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setSelected(new Set(media.map((m) => m.id)))}
            >
              {t("selectAll", { count: media.length })}
            </Button>
            {selected.size > 0 ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelected(new Set())}
              >
                {t("clearSelection")}
              </Button>
            ) : null}
            <span className="text-body-sm text-text-tertiary">
              {t("selectedHint", { count: activeIds.length })}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
            {media.map((item, index) => {
              const overdue = isOverdue(item.createdAt);
              const isSelected = selected.has(item.id);
              const isFocused = index === focusedIndex && selected.size === 0;

              return (
                <Card
                  key={item.id}
                  padding={false}
                  className={cn(
                    "flex cursor-pointer flex-col gap-0 overflow-hidden",
                    (isSelected || isFocused) && "ring-2 ring-brand-primary",
                  )}
                  onClick={() => {
                    setFocusedIndex(index);
                    toggleSelect(item.id);
                  }}
                >
                  <div className="relative aspect-square bg-bg-sunken">
                    {item.type === "VIDEO" ? (
                      <video
                        src={item.url}
                        className="size-full object-cover"
                        muted
                      />
                    ) : (
                      <Image
                        src={buildMediaVariants(item.url).thumbnail}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                        className="object-cover"
                      />
                    )}
                    {overdue ? (
                      <Badge
                        variant="destructive"
                        className="absolute top-1.5 left-1.5"
                      >
                        {t("overdueBadge")}
                      </Badge>
                    ) : null}
                    {isSelected ? (
                      <div className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-brand-primary text-text-on-brand">
                        <Check className="size-3.5" />
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-0.5 p-2">
                    <span className="truncate text-body-sm font-semibold text-text-primary">
                      {item.profile.user.firstName ??
                        item.profile.user.name ??
                        item.profile.user.email}
                    </span>
                    <span className="text-body-sm text-text-tertiary">
                      {item.profile.role}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="sticky bottom-4 flex flex-col gap-2 rounded-[var(--fg-radius-md)] border border-border-default bg-bg-surface p-3.5 shadow-lg">
            {showRejectPanel ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <NativeSelect
                  value={reasonPreset}
                  onChange={setReasonPreset}
                  options={[
                    { value: "", label: t("rejectionReasonPlaceholder") },
                    ...MEDIA_REJECTION_REASONS.map((r) => ({
                      value: r,
                      label: r,
                    })),
                  ]}
                />
                <Textarea
                  placeholder={t("notePlaceholder")}
                  rows={1}
                  value={reasonNote}
                  onChange={(e) => setReasonNote(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    disabled={!reasonPreset || busy}
                    onClick={reject}
                  >
                    {t("confirmReject", { count: activeIds.length })}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setShowRejectPanel(false)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="accent"
                  disabled={activeIds.length === 0 || busy}
                  onClick={() => approve(activeIds)}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  {t("approve", { count: activeIds.length })}
                </Button>
                <Button
                  variant="destructive"
                  disabled={activeIds.length === 0 || busy}
                  onClick={() => setShowRejectPanel(true)}
                >
                  <X className="size-4" />
                  {t("reject", { count: activeIds.length })}
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
