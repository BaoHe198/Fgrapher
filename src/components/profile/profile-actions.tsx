"use client";

import {
  Bookmark,
  Flag,
  Link2,
  QrCode,
  Share2,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import Script from "next/script";
import { startTransition, useEffect, useState } from "react";

import { QrCodeDialog } from "@/components/profile/qr-code-dialog";
import { ReportModal } from "@/components/modals/report-modal";
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
  /** No longer shown: counts stay off the public page (wave 2, option B). */
  initialFollowerCount?: number;
  shareUrl: string;
  socialFeedEnabled: boolean;
  // Follow/save/report all target another account — none of them make
  // sense pointed at yourself (follow-self and message-self are already
  // rejected server-side; save-self and report-self aren't harmful, just
  // nonsensical). Share/QR stay visible either way — sharing your own
  // profile link is exactly what an owner would want to do here.
  isOwnProfile: boolean;
}

export function ProfileActions({
  targetUserId,
  profileId,
  shareUrl,
  socialFeedEnabled,
  isOwnProfile,
}: ProfileActionsProps) {
  const t = useTranslations("publicPages.profile.shareMenu");
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated" && Boolean(session?.user);
  const router = useRouter();
  const pathname = usePathname();
  // A visitor who isn't signed in is sent to sign in and brought back here.
  // These buttons used to be greyed out for them with no hint why, while
  // "Nhắn tin" beside them did exactly this.
  const requireSignIn = () => {
    if (isAuthenticated) return false;
    if (status === "loading") return true;
    router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
    return true;
  };

  const [isFollowing, setIsFollowing] = useState(false);
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
    if (!isAuthenticated || isOwnProfile) return;
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
  }, [isAuthenticated, isOwnProfile, targetUserId, profileId]);

  const toggleFollow = async () => {
    if (requireSignIn()) return;
    const next = !isFollowing;
    setIsFollowing(next);

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
    if (requireSignIn()) return;
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

  // Three separate 44px buttons, 8px apart (Core MVP pass, 02/10/2026):
  // Theo dõi, Lưu, Chia sẻ. Report moved into the share menu. On a phone
  // each carries its label; from 768px the icons alone, named for
  // assistive tech and on hover.
  const action =
    "focus-ring inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border border-border-default bg-bg-surface px-3 text-body-sm font-semibold text-text-primary transition-colors duration-[var(--fg-dur-150)] hover:border-border-strong md:px-0";

  return (
    <div
      role="group"
      aria-label={t("moreActions")}
      className="flex items-center gap-2"
    >
      {socialFeedEnabled && !isOwnProfile ? (
        <button
          type="button"
          onClick={toggleFollow}
          aria-pressed={isFollowing}
          aria-label={isFollowing ? t("following") : t("follow")}
          title={isFollowing ? t("following") : t("follow")}
          className={action}
        >
          {isFollowing ? (
            <UserCheck aria-hidden className="size-[18px]" />
          ) : (
            <UserPlus aria-hidden className="size-[18px]" />
          )}
          <span className="md:hidden">
            {isFollowing ? t("following") : t("follow")}
          </span>
        </button>
      ) : null}

      {!isOwnProfile ? (
        <button
          type="button"
          onClick={toggleSave}
          aria-pressed={isSaved}
          aria-label={isSaved ? t("removeFromSaved") : t("saveProfile")}
          title={isSaved ? t("removeFromSaved") : t("saveProfile")}
          className={action}
        >
          <Bookmark
            aria-hidden
            className={cn("size-[18px]", isSaved && "fill-current")}
          />
          <span className="md:hidden">{t("saveShort")}</span>
        </button>
      ) : null}

      {zaloOaId ? (
        <Script src="https://sp.zalo.me/plugins/sdk.js" strategy="lazyOnload" />
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={t("share")}
              title={t("share")}
              className={action}
            >
              <Share2 aria-hidden className="size-[18px]" />
              <span className="md:hidden">{t("share")}</span>
            </button>
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
          {!isOwnProfile ? (
            <DropdownMenuItem
              onClick={() => {
                if (!requireSignIn()) setReportOpen(true);
              }}
            >
              <Flag className="size-4" />
              {t("report")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

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
