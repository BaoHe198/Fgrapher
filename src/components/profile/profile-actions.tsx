"use client";

import { Bookmark, Check, Flag, Link2, QrCode, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import Script from "next/script";
import { startTransition, useEffect, useState } from "react";

import { QrCodeDialog } from "@/components/profile/qr-code-dialog";
import { ReportModal } from "@/components/modals/report-modal";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface ProfileActionsProps {
  targetUserId: string;
  profileId: string;
  initialFollowerCount: number;
  shareUrl: string;
  socialFeedEnabled: boolean;
}

export function ProfileActions({
  targetUserId,
  profileId,
  initialFollowerCount,
  shareUrl,
  socialFeedEnabled,
}: ProfileActionsProps) {
  const t = useTranslations("publicPages.profile.shareMenu");
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated" && Boolean(session?.user);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  const [isSaved, setIsSaved] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  // Zalo's official share widget needs a registered Zalo Official Account
  // (data-oaid) — there's no unauthenticated sharer.php-style URL for it,
  // unlike Facebook. Not configured in this environment (same category as
  // Stripe/Cloudinary/Resend in CLAUDE.md's "Current phase" notes) — the
  // menu item below simply doesn't render until a real OA ID is set.
  const zaloOaId = process.env.NEXT_PUBLIC_ZALO_OA_ID;

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    fetch(`/api/follows/status?userId=${targetUserId}&profileId=${profileId}`)
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled && body.data) {
          startTransition(() => {
            setIsFollowing(body.data.isFollowing);
            setIsSaved(body.data.isSaved);
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, targetUserId, profileId]);

  const toggleFollow = async () => {
    if (!isAuthenticated) return;
    const next = !isFollowing;
    setIsFollowing(next);
    setFollowerCount((c) => c + (next ? 1 : -1));

    if (next) {
      await fetch("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUserId }),
      }).catch(() => {});
    } else {
      await fetch(`/api/follows?userId=${targetUserId}`, {
        method: "DELETE",
      }).catch(() => {});
    }
  };

  const toggleSave = async () => {
    if (!isAuthenticated) return;
    const next = !isSaved;
    setIsSaved(next);

    if (next) {
      await fetch("/api/saved-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      }).catch(() => {});
    } else {
      await fetch(`/api/saved-profiles?profileId=${profileId}`, {
        method: "DELETE",
      }).catch(() => {});
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    toast.add({ title: t("linkCopied"), type: "success" });
  };

  return (
    <div className="flex items-center gap-2">
      {socialFeedEnabled ? (
        <>
          <Button
            variant={isFollowing ? "ghost" : "secondary"}
            size="sm"
            disabled={!isAuthenticated}
            onClick={toggleFollow}
          >
            {isFollowing ? <Check className="size-4" /> : null}
            {isFollowing ? t("following") : t("follow")}
          </Button>
          <span className="text-body-sm text-text-tertiary">
            {t("followers", { count: followerCount })}
          </span>
        </>
      ) : null}

      <Button
        variant="ghost"
        size="icon-sm"
        disabled={!isAuthenticated}
        onClick={toggleSave}
        aria-label={isSaved ? t("removeFromSaved") : t("saveProfile")}
      >
        <Bookmark className={cn("size-4", isSaved && "fill-current")} />
      </Button>

      {zaloOaId ? (
        <Script src="https://sp.zalo.me/plugins/sdk.js" strategy="lazyOnload" />
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={t("share")}>
              <Share2 className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={copyLink}>
            <Link2 className="size-4" />
            {t("copyLink")}
          </DropdownMenuItem>
          <DropdownMenuItem
            render={
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            {t("shareFacebook")}
          </DropdownMenuItem>
          {zaloOaId ? (
            <div
              className="zalo-share-button px-2 py-1.5"
              data-oaid={zaloOaId}
              data-href={shareUrl}
              data-share-type="4"
              data-layout="1"
              data-color="white"
              data-customize="false"
            />
          ) : null}
          <DropdownMenuItem onClick={() => setQrOpen(true)}>
            <QrCode className="size-4" />
            {t("showQrCode")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="icon-sm"
        disabled={!isAuthenticated}
        onClick={() => setReportOpen(true)}
        aria-label={t("report")}
      >
        <Flag className="size-4" />
      </Button>
      <ReportModal
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="user"
        targetId={targetUserId}
      />
      <QrCodeDialog open={qrOpen} onOpenChange={setQrOpen} url={shareUrl} />
    </div>
  );
}
