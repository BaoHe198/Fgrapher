"use client";

import { Bookmark, Check, Flag, Link2, Share2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { startTransition, useEffect, useState } from "react";

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
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated" && Boolean(session?.user);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  const [isSaved, setIsSaved] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

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
    toast.add({ title: "Link copied", type: "success" });
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
            {isFollowing ? "Following" : "Follow"}
          </Button>
          <span className="text-body-sm text-text-tertiary">
            {followerCount} followers
          </span>
        </>
      ) : null}

      <Button
        variant="ghost"
        size="icon-sm"
        disabled={!isAuthenticated}
        onClick={toggleSave}
        aria-label={isSaved ? "Remove from saved" : "Save profile"}
      >
        <Bookmark className={cn("size-4", isSaved && "fill-current")} />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="Share">
              <Share2 className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={copyLink}>
            <Link2 className="size-4" />
            Copy link
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
            Share to Facebook
          </DropdownMenuItem>
          <DropdownMenuItem
            render={
              <a
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            Share to X
          </DropdownMenuItem>
          <DropdownMenuItem
            render={
              <a
                href={`https://wa.me/?text=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            Share via WhatsApp
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="icon-sm"
        disabled={!isAuthenticated}
        onClick={() => setReportOpen(true)}
        aria-label="Report this profile"
      >
        <Flag className="size-4" />
      </Button>
      <ReportModal
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="user"
        targetId={targetUserId}
      />
    </div>
  );
}
