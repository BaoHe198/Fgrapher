"use client";

import { Heart, Loader2, MessageCircle, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface FeedComment {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string | null; firstName: string | null };
}

export function PostEngagement({
  postId,
  viewerId,
  initialLiked,
  initialLikeCount,
  initialCommentCount,
  className,
}: {
  postId: string;
  viewerId: string | null;
  initialLiked: boolean;
  initialLikeCount: number;
  initialCommentCount: number;
  className?: string;
}) {
  const t = useTranslations("publicPages.community");
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [comments, setComments] = useState<FeedComment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggleLike = async () => {
    if (!viewerId) return;
    const res = await fetch(`/api/posts/${postId}/like`, { method: "POST" });
    const body = await res.json();
    if (res.ok) {
      setLiked(body.data.liked);
      setLikeCount(body.data.likeCount);
    }
  };

  const toggleComments = async () => {
    if (comments) {
      setComments(null);
      return;
    }
    setLoadingComments(true);
    const res = await fetch(`/api/posts/${postId}/comments`);
    const body = await res.json();
    setComments(body.data ?? []);
    setLoadingComments(false);
  };

  const sendComment = async () => {
    if (!draft.trim() || busy) return;
    setBusy(true);
    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: draft }),
    });
    const body = await res.json();
    setBusy(false);
    if (res.ok) {
      setComments((current) => [...(current ?? []), body.data]);
      setCommentCount((count) => count + 1);
      setDraft("");
    }
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-5 border-t border-border-subtle pt-3">
        {viewerId ? (
          <button
            type="button"
            onClick={toggleLike}
            aria-pressed={liked}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 text-body-sm transition-colors hover:text-brand-primary",
              liked ? "text-brand-primary" : "text-text-secondary",
            )}
          >
            <Heart className={cn("size-4", liked && "fill-current")} />
            {t("likes", { count: likeCount })}
          </button>
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-1.5 text-body-sm text-text-secondary hover:text-brand-primary"
          >
            <Heart className="size-4" />
            {t("likes", { count: likeCount })}
          </Link>
        )}
        <button
          type="button"
          onClick={toggleComments}
          className="flex cursor-pointer items-center gap-1.5 text-body-sm text-text-secondary transition-colors hover:text-brand-primary"
        >
          {loadingComments ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MessageCircle className="size-4" />
          )}
          {t("comments", { count: commentCount })}
        </button>
      </div>

      {comments ? (
        <div className="flex flex-col gap-3 rounded-[var(--fg-radius-md)] bg-bg-sunken p-3">
          {comments.length === 0 ? (
            <p className="text-body-sm text-text-tertiary">{t("noComments")}</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex flex-col">
                <span className="text-body-sm font-semibold! text-text-primary">
                  {comment.user.firstName ?? comment.user.name ?? ""}
                </span>
                <span className="whitespace-pre-wrap text-body-sm text-text-secondary">
                  {comment.content}
                </span>
              </div>
            ))
          )}
          {viewerId ? (
            <div className="flex items-end gap-2">
              <Textarea
                aria-label={t("commentPlaceholder")}
                placeholder={t("commentPlaceholder")}
                rows={1}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendComment();
                  }
                }}
              />
              <Button
                size="icon"
                variant="accent"
                disabled={busy || !draft.trim()}
                aria-label={t("send")}
                onClick={() => void sendComment()}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </div>
          ) : (
            <Link href="/login" className="text-body-sm text-brand-primary">
              {t("loginToInteract")}
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
