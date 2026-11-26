"use client";

import type { Role } from "@prisma/client";
import { Check, Expand, ImageOff, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  MEDIA_MODERATION_SLA_HOURS,
  MEDIA_REJECTION_REASONS,
} from "@/lib/constants";
import {
  PortfolioVideoPlayer,
  VideoTile,
} from "@/components/media/portfolio-video";
import { linkedVideo } from "@/lib/media/video-link";
import { buildMediaVariants } from "@/lib/media/variants";
import { cn, formatRelativeTime } from "@/lib/utils";

interface MediaRow {
  id: string;
  url: string;
  type: "IMAGE" | "VIDEO";
  createdAt: string;
  // Set when the tier-1 scan thought this one worth looking at first — the
  // category and score it gave. Everything in this queue is PENDING; the
  // flag sorts it, nothing more (services/moderation.ts).
  autoFlagReason: string | null;
  profile: {
    role: string;
    displayName: string | null;
    user: { name: string | null; firstName: string | null; email: string };
  };
  album: { id: string; title: string } | null;
  /** Which table the row came from; a product photo carries its listing. */
  kind?: "profile" | "product" | "post";
  productName?: string;
}

function isOverdue(createdAt: string) {
  return (
    Date.now() - new Date(createdAt).getTime() >
    MEDIA_MODERATION_SLA_HOURS * 3_600_000
  );
}

export default function AdminModerationPage() {
  const t = useTranslations("accountFlows.admin.moderation");
  const router = useRouter();
  const roleT = useTranslations("role");
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [reasonPreset, setReasonPreset] = useState("");
  const [reasonNote, setReasonNote] = useState("");
  const [showRejectPanel, setShowRejectPanel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [roleFilter, setRoleFilter] = useState("");
  const [lightboxItem, setLightboxItem] = useState<MediaRow | null>(null);

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

  const roleOptions = useMemo(
    () => Array.from(new Set(media.map((m) => m.profile.role))).sort(),
    [media],
  );

  const filteredMedia = useMemo(
    () =>
      roleFilter ? media.filter((m) => m.profile.role === roleFilter) : media,
    [media, roleFilter],
  );

  const activeIds = useMemo(() => {
    if (selected.size > 0) return Array.from(selected);
    return filteredMedia[focusedIndex] ? [filteredMedia[focusedIndex].id] : [];
  }, [selected, filteredMedia, focusedIndex]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // A decided photo leaves the list at once, before the reload answers.
  // The list used to stay as it was until then, with the focus still on the
  // photo just rejected, so pressing A in that gap approved it: the provider
  // was told "rejected", then "approved", for one photo (found 25/11/2026).
  const dropFromQueue = useCallback((ids: string[]) => {
    const decided = new Set(ids);
    setMedia((prev) => prev.filter((item) => !decided.has(item.id)));
    setSelected(new Set());
    setFocusedIndex(0);
  }, []);

  const approve = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0 || busy) return;
      setBusy(true);
      const res = await fetch("/api/admin/moderation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", mediaIds: ids }),
      });
      setBusy(false);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.add({
          title: body?.message ?? t("actionFailed"),
          type: "error",
        });
        return;
      }
      toast.add({
        title: t("approvedToast", { count: ids.length }),
        type: "success",
      });
      dropFromQueue(ids);
      load();
      // The sidebar's waiting count is rendered by the server layout.
      router.refresh();
    },
    [busy, dropFromQueue, load, router, t],
  );

  const reject = async () => {
    if (activeIds.length === 0 || !reasonPreset || busy) return;
    setBusy(true);
    const reason = reasonNote.trim()
      ? `${reasonPreset} — ${reasonNote.trim()}`
      : reasonPreset;
    const res = await fetch("/api/admin/moderation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", mediaIds: activeIds, reason }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.add({ title: body?.message ?? t("actionFailed"), type: "error" });
      return;
    }
    setShowRejectPanel(false);
    setReasonPreset("");
    setReasonNote("");
    toast.add({
      title: t("rejectedToast", { count: activeIds.length }),
      type: "success",
    });
    dropFromQueue(activeIds);
    load();
    router.refresh();
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
        setFocusedIndex((i) => Math.min(i + 1, filteredMedia.length - 1));
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
  }, [filteredMedia.length, activeIds, approve]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-display-md text-text-primary">{t("title")}</h1>
        <p className="text-body-md text-text-secondary">
          {t("description", { hours: MEDIA_MODERATION_SLA_HOURS })}
        </p>
      </div>

      {isLoading ? (
        <ListSkeleton />
      ) : media.length === 0 ? (
        <EmptyState icon={<ImageOff />} title={t("empty")} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                setSelected(new Set(filteredMedia.map((m) => m.id)))
              }
            >
              {t("selectAll", { count: filteredMedia.length })}
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
            <div className="ml-auto w-44">
              <NativeSelect
                value={roleFilter}
                onChange={(value) => {
                  setRoleFilter(value);
                  setFocusedIndex(0);
                  setSelected(new Set());
                }}
                options={[
                  { value: "", label: t("allRoles") },
                  ...roleOptions.map((role) => ({
                    value: role,
                    label: roleT(role as Role),
                  })),
                ]}
              />
            </div>
          </div>

          {filteredMedia.length === 0 ? (
            <EmptyState icon={<ImageOff />} title={t("emptyFiltered")} />
          ) : (
            <div className="grid grid-cols-2 gap-3.5 pb-28 sm:grid-cols-3 sm:pb-6 lg:grid-cols-5">
              {filteredMedia.map((item, index) => {
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
                        <VideoTile url={item.url} />
                      ) : (
                        <Image
                          src={buildMediaVariants(item.url).thumbnail}
                          alt=""
                          fill
                          sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                          className="object-cover"
                        />
                      )}
                      {item.autoFlagReason ? (
                        <Badge
                          variant="destructive"
                          className="absolute top-1.5 left-1.5"
                        >
                          {t("autoFlaggedBadge")}
                        </Badge>
                      ) : overdue ? (
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
                      ) : (
                        <Button
                          variant="secondary"
                          size="icon-sm"
                          className="absolute top-1.5 right-1.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightboxItem(item);
                          }}
                        >
                          <Expand className="size-3.5" />
                          <span className="sr-only">{t("viewLarge")}</span>
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5 p-2">
                      <span className="truncate text-body-sm font-semibold! text-text-primary">
                        {item.profile.displayName ??
                          item.profile.user.name ??
                          item.profile.user.firstName ??
                          item.profile.user.email}
                      </span>
                      <span className="text-body-sm text-text-tertiary">
                        {roleT(item.profile.role as Role)}
                      </span>
                      {/* What the photo is of: the listing or the album.
                          A product photo showed only the seller's name. */}
                      {item.kind === "product" && item.productName ? (
                        <span className="line-clamp-2 text-body-sm text-text-secondary">
                          {t("productLabel", { name: item.productName })}
                        </span>
                      ) : item.album ? (
                        <span className="line-clamp-2 text-body-sm text-text-secondary">
                          {t("albumLabel", { title: item.album.title })}
                        </span>
                      ) : item.kind === "post" ? (
                        <span className="text-body-sm text-text-secondary">
                          {t("postLabel")}
                        </span>
                      ) : null}
                      <span className="text-body-sm text-text-tertiary">
                        {t("waitingSince", {
                          time: formatRelativeTime(new Date(item.createdAt)),
                        })}
                      </span>
                      {item.type === "VIDEO" &&
                      linkedVideo(item.url)?.provider === "vimeo" ? (
                        // Approving a Vimeo link approves an address, not a
                        // file: its owner can replace the video later
                        // (lib/media/video-link.ts). The reviewer should
                        // know that when deciding.
                        <span className="text-body-sm text-warning">
                          {t("vimeoWarning")}
                        </span>
                      ) : null}
                      {item.autoFlagReason ? (
                        // A hint about where to look first, not a verdict —
                        // the photo is as PENDING as everything else here.
                        <span className="text-body-sm text-danger">
                          {t("autoFlaggedReason", {
                            reason: item.autoFlagReason,
                          })}
                        </span>
                      ) : null}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="sticky bottom-4 flex flex-col gap-2 rounded-[var(--fg-radius-md)] border border-border-default bg-bg-surface p-3.5 shadow-[var(--shadow-lg)]">
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

      <Dialog
        open={lightboxItem !== null}
        onOpenChange={(open) => {
          if (!open) setLightboxItem(null);
        }}
      >
        <DialogContent className="max-w-3xl bg-transparent p-0 ring-0 sm:max-w-3xl">
          {lightboxItem ? (
            lightboxItem.type === "VIDEO" ? (
              // The reviewer watches exactly what a visitor would: the
              // uploaded file, or the linked YouTube video in its player.
              <PortfolioVideoPlayer
                url={lightboxItem.url}
                title={lightboxItem.album?.title ?? "Video"}
                autoPlay
                className="max-h-[80vh] w-full rounded-[var(--fg-radius-lg)]"
                frameClassName="w-full rounded-[var(--fg-radius-lg)]"
              />
            ) : (
              <Image
                src={buildMediaVariants(lightboxItem.url).large}
                alt=""
                width={1200}
                height={1200}
                className="max-h-[80vh] w-full rounded-[var(--fg-radius-lg)] object-contain"
              />
            )
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
