import Image from "next/image";
import { useTranslations } from "next-intl";

import { formatRelativeTime } from "@/lib/utils";

export interface ProfilePost {
  id: string;
  caption: string | null;
  createdAt: Date;
  likeCount: number;
  commentCount: number;
  media: { id: string; url: string }[];
}

export function PostsTab({ posts }: { posts: ProfilePost[] }) {
  const t = useTranslations("publicPages.profile.postsTab");

  if (posts.length === 0) {
    return (
      <p className="py-12 text-center text-body-md text-text-secondary">
        {t("empty")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {posts.map((post) => (
        <div key={post.id} className="flex flex-col gap-2">
          <span className="text-body-sm text-text-tertiary">
            {formatRelativeTime(post.createdAt)}
          </span>
          {post.caption ? (
            <p className="whitespace-pre-wrap text-body-md text-text-primary">
              {post.caption}
            </p>
          ) : null}
          {post.media.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {post.media.map((item) => (
                <div
                  key={item.id}
                  className="relative aspect-square overflow-hidden rounded-[var(--fg-radius-md)]"
                >
                  <Image
                    src={item.url}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 220px, 45vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          ) : null}
          <span className="text-body-sm text-text-tertiary">
            {t("stats", {
              likes: post.likeCount,
              comments: post.commentCount,
            })}
          </span>
        </div>
      ))}
    </div>
  );
}
