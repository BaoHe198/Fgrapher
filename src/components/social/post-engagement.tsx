"use client";

import { Heart, Loader2, MessageCircle, Send, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface FeedComment {
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
  postOwnerId,
  initialComments,
  className,
}: {
  postId: string;
  viewerId: string | null;
  /** The post's author may remove any comment under it (spam clean-up). */
  postOwnerId?: string;
  /** Comments already loaded on the server — the post's own page shows them open. */
  initialComments?: FeedComment[];
  initialLiked: boolean;
  initialLikeCount: number;
  initialCommentCount: number;
  className?: string;
}) {
  const t = useTranslations("publicPages.community");
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [comments, setComments] = useState<FeedComment[] | null>(
    initialComments ?? null,
  );
  const [draft, setDraft] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [busy, setBusy] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const pathname = usePathname();
  const loginHref = `/login?callbackUrl=${encodeURIComponent(pathname)}`;

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
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok) {
      setComments((current) => [...(current ?? []), body.data]);
      setCommentCount((count) => count + 1);
      setDraft("");
      setCommentError(null);
    } else {
      // Keep the draft so nothing typed is lost, and say what happened —
      // a failed send used to look exactly like nothing happening.
      setCommentError(body?.message ?? t("commentFailed"));
    }
  };

  const canDelete = (comment: FeedComment) =>
    Boolean(viewerId) &&
    (comment.user.id === viewerId || postOwnerId === viewerId);

  const deleteComment = async (commentId: string) => {
    if (!window.confirm(t("deleteCommentConfirm"))) return;
    setDeletingId(commentId);
    const res = await fetch(`/api/posts/${postId}/comments/${commentId}`, {
      method: "DELETE",
    }).catch(() => null);
    setDeletingId(null);
    if (res?.ok) {
      setComments((current) =>
        (current ?? []).filter((comment) => comment.id !== commentId),
      );
      setCommentCount((count) => Math.max(0, count - 1));
      setCommentError(null);
    } else {
      const body = await res?.json().catch(() => null);
      setCommentError(body?.message ?? t("deleteCommentFailed"));
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
            href={loginHref}
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
              <div key={comment.id} className="flex items-start gap-2">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body-sm font-semibold! text-text-primary">
                    {comment.user.firstName ?? comment.user.name ?? ""}
                  </span>
                  <span className="text-body-sm break-words whitespace-pre-wrap [overflow-wrap:anywhere] text-text-secondary">
                    {comment.content}
                  </span>
                </div>
                {canDelete(comment) ? (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t("deleteComment")}
                    disabled={deletingId === comment.id}
                    onClick={() => void deleteComment(comment.id)}
                  >
                    {deletingId === comment.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </Button>
                ) : null}
              </div>
            ))
          )}
          {commentError ? (
            <p className="text-body-sm text-danger" role="alert">
              {commentError}
            </p>
          ) : null}
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
            <Link href={loginHref} className="text-body-sm text-brand-primary">
              {t("loginToInteract")}
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
