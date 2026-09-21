"use client";

import { Heart, Loader2, MessageCircle, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { startTransition, useCallback, useEffect, useState } from "react";

import {
  ProductImageUploader,
  type ProductImage,
} from "@/components/forms/product-image-uploader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatRelativeTime } from "@/lib/utils";

interface FeedPost {
  id: string;
  caption: string | null;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  likedByViewer: boolean;
  user: {
    id: string;
    name: string | null;
    firstName: string | null;
    username: string | null;
    avatar: string | null;
  };
  media: { id: string; url: string; type: string }[];
}

interface FeedComment {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string | null; firstName: string | null };
}

function authorName(user: FeedPost["user"]) {
  return user.firstName ?? user.name ?? "";
}

export function CommunityFeed({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}) {
  const t = useTranslations("publicPages.community");
  const [tab, setTab] = useState<"discover" | "following">("discover");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(
    async (nextTab: "discover" | "following", nextCursor?: string | null) => {
      startTransition(() => setIsLoading(true));
      const query = new URLSearchParams({ tab: nextTab });
      if (nextCursor) query.set("cursor", nextCursor);
      const res = await fetch(`/api/posts?${query.toString()}`);
      const body = await res.json();
      startTransition(() => {
        setPosts((prev) =>
          nextCursor ? [...prev, ...(body.data ?? [])] : (body.data ?? []),
        );
        setCursor(body.nextCursor ?? null);
        setPendingCount(body.pendingCount ?? 0);
        setIsLoading(false);
      });
    },
    [],
  );

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  return (
    <div className="flex flex-col gap-5">
      {pendingCount > 0 ? (
        <Card className="border-brand-primary text-body-sm text-text-secondary">
          {t("pendingBanner", { count: pendingCount })}
        </Card>
      ) : null}

      {isAuthenticated ? (
        <PostComposer
          onPublished={(post) => {
            // A post with photos is not in anybody's feed until those are
            // approved, so it must not appear in the author's either — the
            // banner says where it went instead.
            if (post) setPosts((prev) => [post, ...prev]);
            else setPendingCount((count) => count + 1);
          }}
        />
      ) : (
        <Card className="text-body-md text-text-secondary">
          <Link href="/login" className="underline">
            {t("loginToPost")}
          </Link>
        </Card>
      )}

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as "discover" | "following")}
      >
        <TabsList>
          <TabsTab value="discover">{t("tabDiscover")}</TabsTab>
          <TabsTab value="following">{t("tabFollowing")}</TabsTab>
        </TabsList>
      </Tabs>

      {isLoading && posts.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-text-tertiary" />
        </div>
      ) : posts.length === 0 ? (
        <p className="py-16 text-center text-body-md text-text-secondary">
          {tab === "following" ? t("emptyFollowing") : t("empty")}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              isAuthenticated={isAuthenticated}
              onDeleted={(id) =>
                setPosts((prev) => prev.filter((p) => p.id !== id))
              }
            />
          ))}
        </div>
      )}

      {cursor ? (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            size="sm"
            disabled={isLoading}
            onClick={() => void load(tab, cursor)}
          >
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("loadMore")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function PostComposer({
  onPublished,
}: {
  /** The new post when it is already public, or null when it is held for review. */
  onPublished: (post: FeedPost | null) => void;
}) {
  const t = useTranslations("publicPages.community");
  const [caption, setCaption] = useState("");
  // Reuses the product uploader: it is a generic compress-then-upload
  // dropzone, and a second copy of that would drift from this one.
  const [images, setImages] = useState<ProductImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caption: caption.trim() || undefined,
        media: images.map((image) => ({
          url: image.url,
          publicId: image.publicId ?? null,
          type: "IMAGE",
        })),
      }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body.message ?? t("publishFailed"));
      return;
    }
    const heldForReview = images.length > 0;
    setCaption("");
    setImages([]);
    setNotice(heldForReview ? t("submittedForReview") : null);
    onPublished(
      heldForReview
        ? null
        : {
            ...body.data,
            likeCount: 0,
            commentCount: 0,
            likedByViewer: false,
            media: [],
          },
    );
  };

  return (
    <Card className="flex flex-col gap-3">
      <Textarea
        aria-label={t("composerPlaceholder")}
        placeholder={t("composerPlaceholder")}
        rows={3}
        value={caption}
        onChange={(event) => setCaption(event.target.value)}
      />
      <ProductImageUploader images={images} onChange={setImages} />
      {notice ? (
        <p className="text-body-sm text-text-secondary">{notice}</p>
      ) : null}
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
      <div className="flex justify-end">
        <Button
          variant="accent"
          size="sm"
          disabled={busy || (!caption.trim() && images.length === 0)}
          onClick={submit}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          {busy ? t("publishing") : t("publish")}
        </Button>
      </div>
    </Card>
  );
}

function PostCard({
  post,
  isAuthenticated,
  onDeleted,
}: {
  post: FeedPost;
  isAuthenticated: boolean;
  onDeleted: (postId: string) => void;
}) {
  const t = useTranslations("publicPages.community");
  const [liked, setLiked] = useState(post.likedByViewer);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [comments, setComments] = useState<FeedComment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const toggleLike = async () => {
    if (!isAuthenticated) return;
    const res = await fetch(`/api/posts/${post.id}/like`, { method: "POST" });
    const body = await res.json();
    if (res.ok) {
      setLiked(body.data.liked);
      setLikeCount(body.data.likeCount);
    }
  };

  const openComments = async () => {
    if (comments) {
      setComments(null);
      return;
    }
    const res = await fetch(`/api/posts/${post.id}/comments`);
    const body = await res.json();
    setComments(body.data ?? []);
  };

  const sendComment = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/posts/${post.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: draft }),
    });
    const body = await res.json();
    setBusy(false);
    if (res.ok) {
      setComments((prev) => [...(prev ?? []), body.data]);
      setCommentCount((count) => count + 1);
      setDraft("");
    }
  };

  const remove = async () => {
    if (!window.confirm(t("deleteConfirm"))) return;
    const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
    if (res.ok) onDeleted(post.id);
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar className="size-10">
          {post.user.avatar ? (
            <AvatarImage src={post.user.avatar} alt="" />
          ) : null}
          <AvatarFallback>
            {authorName(post.user)[0]?.toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          {post.user.username ? (
            <Link
              href={`/profile/${post.user.username}`}
              className="truncate text-body-md font-semibold! text-text-primary hover:underline"
            >
              {authorName(post.user)}
            </Link>
          ) : (
            <span className="truncate text-body-md font-semibold! text-text-primary">
              {authorName(post.user)}
            </span>
          )}
          <span className="text-body-sm text-text-tertiary">
            {formatRelativeTime(new Date(post.createdAt))}
          </span>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={t("delete")}
          onClick={remove}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {post.caption ? (
        <p className="whitespace-pre-wrap text-body-md text-text-primary">
          {post.caption}
        </p>
      ) : null}

      {post.media.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {post.media.map((item) => (
            <div
              key={item.id}
              className="relative aspect-square overflow-hidden rounded-[var(--fg-radius-md)]"
            >
              <Image
                src={item.url}
                alt=""
                fill
                sizes="(min-width: 640px) 320px, 45vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-4 border-t border-border-subtle pt-3">
        <button
          type="button"
          onClick={toggleLike}
          className={`flex items-center gap-1.5 text-body-sm ${
            liked ? "text-brand-primary" : "text-text-secondary"
          }`}
        >
          <Heart className="size-4" />
          {t("likes", { count: likeCount })}
        </button>
        <button
          type="button"
          onClick={openComments}
          className="flex items-center gap-1.5 text-body-sm text-text-secondary"
        >
          <MessageCircle className="size-4" />
          {t("comments", { count: commentCount })}
        </button>
      </div>

      {comments ? (
        <div className="flex flex-col gap-2">
          {comments.map((comment) => (
            <div key={comment.id} className="flex flex-col">
              <span className="text-body-sm font-semibold! text-text-primary">
                {comment.user.firstName ?? comment.user.name ?? ""}
              </span>
              <span className="text-body-sm text-text-secondary">
                {comment.content}
              </span>
            </div>
          ))}
          {isAuthenticated ? (
            <div className="flex gap-2">
              <Textarea
                aria-label={t("commentPlaceholder")}
                placeholder={t("commentPlaceholder")}
                rows={1}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <Button size="sm" disabled={busy} onClick={sendComment}>
                {t("send")}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
