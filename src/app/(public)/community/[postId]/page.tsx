import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { auth } from "@/lib/auth";
import { features } from "@/lib/features";
import { formatRelativeTime } from "@/lib/utils";
import { getPost, listComments } from "@/services/posts";

interface PostPageProps {
  params: Promise<{ postId: string }>;
}

export async function generateMetadata({ params }: PostPageProps) {
  const t = await getTranslations("publicPages.community");
  const { postId } = await params;
  const post = await getPost(postId, null);
  if (!post) return { title: `${t("heading")} — Fgrapher` };
  const author = post.user.firstName ?? post.user.name ?? "";
  return {
    title: `${author} — ${t("heading")} — Fgrapher`,
    description: post.caption?.slice(0, 160) ?? undefined,
  };
}

export default async function PostPage({ params }: PostPageProps) {
  // Dormant while SOCIAL_FEED_ENABLED=false — see CLAUDE.md.
  if (!features.socialFeedEnabled) notFound();

  const t = await getTranslations("publicPages.community");
  const { postId } = await params;
  const session = await auth();
  const post = await getPost(postId, session?.user?.id ?? null);
  if (!post) notFound();

  const comments = await listComments(post.id);
  const author = post.user.firstName ?? post.user.name ?? "";

  return (
    <div className="mx-auto max-w-[680px] px-4 py-8 sm:px-8">
      <Link
        href="/community"
        className="mb-5 inline-block text-body-sm text-text-secondary hover:underline"
      >
        ← {t("heading")}
      </Link>

      <article className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-11">
            {post.user.avatar ? (
              <AvatarImage src={post.user.avatar} alt="" />
            ) : null}
            <AvatarFallback>{author[0]?.toUpperCase() ?? "?"}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            {post.user.username ? (
              <Link
                href={`/profile/${post.user.username}`}
                className="text-body-md font-semibold! text-text-primary hover:underline"
              >
                {author}
              </Link>
            ) : (
              <span className="text-body-md font-semibold! text-text-primary">
                {author}
              </span>
            )}
            <span className="text-body-sm text-text-tertiary">
              {formatRelativeTime(post.createdAt)}
            </span>
          </div>
        </div>

        {post.caption ? (
          <p className="whitespace-pre-wrap text-body-lg text-text-primary">
            {post.caption}
          </p>
        ) : null}

        {/* Photos still awaiting moderation are absent from `media`, which is
            why a pending post reached through its own permalink shows its
            text and nothing else. */}
        {post.media.length > 0 ? (
          <div className="flex flex-col gap-2">
            {post.media.map((item) => (
              <div
                key={item.id}
                className={
                  item.width && item.height
                    ? "relative w-full overflow-hidden rounded-[var(--fg-radius-md)]"
                    : "relative aspect-[4/3] w-full overflow-hidden rounded-[var(--fg-radius-md)]"
                }
                // Natural aspect ratio when the upload recorded its
                // dimensions, which is what a photo permalink should show;
                // a 4:3 box only for older rows that did not.
                style={
                  item.width && item.height
                    ? { aspectRatio: `${item.width} / ${item.height}` }
                    : undefined
                }
              >
                <Image
                  src={item.url}
                  alt=""
                  fill
                  sizes="(min-width: 680px) 680px, 100vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex gap-4 border-t border-border-subtle pt-3 text-body-sm text-text-secondary">
          <span>{t("likes", { count: post.likeCount })}</span>
          <span>{t("comments", { count: post.commentCount })}</span>
        </div>

        {comments.length > 0 ? (
          <div className="flex flex-col gap-3">
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
          </div>
        ) : null}
      </article>
    </div>
  );
}
