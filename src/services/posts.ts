import { db } from "@/lib/db";
import { runPostMediaModeration } from "@/services/moderation";
import { notify } from "@/services/notification";

export class PostError extends Error {
  constructor(
    message: string,
    public status: 400 | 403 | 404 | 409 | 429,
  ) {
    super(message);
    this.name = "PostError";
  }
}

const FEED_PAGE_SIZE = 12;
const COMMENT_PAGE_SIZE = 20;

// Anti-spam. Deliberately counted from the database rather than an in-memory
// map: the app runs on serverless functions, so anything held in process
// memory resets whenever a new instance starts and enforces nothing.
const POST_LIMIT_PER_HOUR = 10;
const COMMENT_LIMIT_PER_HOUR = 30;

async function assertUnderLimit(
  userId: string,
  kind: "post" | "comment",
): Promise<void> {
  const since = new Date(Date.now() - 3_600_000);
  const [count, limit] =
    kind === "post"
      ? [
          await db.post.count({
            where: { userId, createdAt: { gte: since }, deletedAt: null },
          }),
          POST_LIMIT_PER_HOUR,
        ]
      : [
          await db.comment.count({
            where: { userId, createdAt: { gte: since }, deletedAt: null },
          }),
          COMMENT_LIMIT_PER_HOUR,
        ];

  if (count >= limit) {
    throw new PostError(
      kind === "post"
        ? "You have posted a lot in the last hour — try again later"
        : "You have commented a lot in the last hour — try again later",
      429,
    );
  }
}

export async function createPost({
  userId,
  caption,
  media,
}: {
  userId: string;
  caption?: string;
  media: { url: string; publicId?: string | null; type: "IMAGE" | "VIDEO" }[];
}) {
  if (!caption?.trim() && media.length === 0) {
    throw new PostError("A post needs a caption or a photo", 400);
  }
  await assertUnderLimit(userId, "post");

  const post = await db.post.create({
    data: {
      userId,
      caption: caption?.trim() || null,
      media: {
        create: media.map((item, index) => ({
          url: item.url,
          publicId: item.publicId ?? null,
          type: item.type,
          order: index,
        })),
      },
    },
    include: { media: true },
  });

  // Fire-and-forget, like the portfolio and product upload paths: every
  // photo is PENDING regardless, the scan only orders the admin's queue.
  for (const item of post.media) {
    void runPostMediaModeration(item.id);
  }

  return post;
}

/**
 * A post is public once it has no media at all (text only) or at least one
 * APPROVED photo. Pending media is not shown, so a post whose only photo is
 * awaiting review stays out of the feed rather than appearing empty.
 */
const PUBLIC_POST_WHERE = {
  deletedAt: null,
  OR: [
    { media: { none: {} } },
    { media: { some: { moderationStatus: "APPROVED" as const } } },
  ],
};

const FEED_SELECT = {
  id: true,
  caption: true,
  createdAt: true,
  likeCount: true,
  commentCount: true,
  user: {
    select: {
      id: true,
      name: true,
      firstName: true,
      username: true,
      avatar: true,
    },
  },
  media: {
    where: { moderationStatus: "APPROVED" as const },
    orderBy: { order: "asc" as const },
    select: { id: true, url: true, type: true, width: true, height: true },
  },
} as const;

export interface FeedCursor {
  createdAt: string;
  id: string;
}

function encodeCursor(post: { createdAt: Date; id: string }) {
  return `${post.createdAt.toISOString()}_${post.id}`;
}

function decodeCursor(cursor: string | null | undefined) {
  if (!cursor) return null;
  const at = cursor.lastIndexOf("_");
  if (at <= 0) return null;
  const createdAt = new Date(cursor.slice(0, at));
  if (Number.isNaN(createdAt.getTime())) return null;
  return { createdAt, id: cursor.slice(at + 1) };
}

/**
 * Keyset pagination, not offset: the feed gains rows at the top while
 * somebody scrolls, and offset paging would then hand them rows they have
 * already seen. Ties on the same timestamp are broken by id, which is why
 * the cursor carries both.
 */
export async function listFeed({
  viewerId,
  tab,
  cursor,
}: {
  viewerId: string | null;
  tab: "following" | "discover";
  cursor?: string | null;
}) {
  const decoded = decodeCursor(cursor);

  const where: Record<string, unknown> = { ...PUBLIC_POST_WHERE };

  if (tab === "following") {
    if (!viewerId) return { data: [], nextCursor: null };
    const following = await db.follow.findMany({
      where: { followerId: viewerId },
      select: { followingId: true },
    });
    if (following.length === 0) return { data: [], nextCursor: null };
    where.userId = { in: following.map((f) => f.followingId) };
  }

  if (decoded) {
    where.OR = [
      { createdAt: { lt: decoded.createdAt } },
      { createdAt: decoded.createdAt, id: { lt: decoded.id } },
    ];
    // PUBLIC_POST_WHERE also uses OR, so its clause moves into AND to keep
    // both conditions rather than letting one overwrite the other.
    where.AND = [{ OR: PUBLIC_POST_WHERE.OR }];
  }

  const posts = await db.post.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: FEED_PAGE_SIZE + 1,
    select: FEED_SELECT,
  });

  const hasMore = posts.length > FEED_PAGE_SIZE;
  const page = hasMore ? posts.slice(0, FEED_PAGE_SIZE) : posts;

  const likedIds = viewerId
    ? new Set(
        (
          await db.like.findMany({
            where: { userId: viewerId, postId: { in: page.map((p) => p.id) } },
            select: { postId: true },
          })
        ).map((l) => l.postId),
      )
    : new Set<string>();

  return {
    data: page.map((post) => ({
      ...post,
      likedByViewer: likedIds.has(post.id),
    })),
    nextCursor: hasMore ? encodeCursor(page[page.length - 1]) : null,
  };
}

/** Returns the post's new like state and count. */
export async function toggleLike(postId: string, userId: string) {
  const post = await db.post.findUnique({
    where: { id: postId },
    select: { id: true, userId: true, deletedAt: true },
  });
  if (!post || post.deletedAt) throw new PostError("Post not found", 404);

  const existing = await db.like.findUnique({
    where: { userId_postId: { userId, postId } },
  });

  if (existing) {
    const [, updated] = await db.$transaction([
      db.like.delete({ where: { id: existing.id } }),
      db.post.update({
        where: { id: postId },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true },
      }),
    ]);
    return { liked: false, likeCount: updated.likeCount };
  }

  const [, updated] = await db.$transaction([
    db.like.create({ data: { userId, postId } }),
    db.post.update({
      where: { id: postId },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true },
    }),
  ]);

  if (post.userId !== userId) {
    await notify({
      userId: post.userId,
      type: "NEW_LIKE",
      title: "Someone liked your post",
      message: "Your post got a new like.",
      data: { postId },
    });
  }

  return { liked: true, likeCount: updated.likeCount };
}

export async function addComment({
  postId,
  userId,
  content,
}: {
  postId: string;
  userId: string;
  content: string;
}) {
  const post = await db.post.findUnique({
    where: { id: postId },
    select: { id: true, userId: true, deletedAt: true },
  });
  if (!post || post.deletedAt) throw new PostError("Post not found", 404);

  await assertUnderLimit(userId, "comment");

  const [comment] = await db.$transaction([
    db.comment.create({
      data: { postId, userId, content: content.trim() },
      include: {
        user: {
          select: { id: true, name: true, firstName: true, avatar: true },
        },
      },
    }),
    db.post.update({
      where: { id: postId },
      data: { commentCount: { increment: 1 } },
    }),
  ]);

  if (post.userId !== userId) {
    await notify({
      userId: post.userId,
      type: "NEW_COMMENT",
      title: "New comment on your post",
      message: content.trim().slice(0, 120),
      data: { postId },
    });
  }

  return comment;
}

export async function listComments(postId: string) {
  return db.comment.findMany({
    where: { postId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    take: COMMENT_PAGE_SIZE,
    include: {
      user: { select: { id: true, name: true, firstName: true, avatar: true } },
    },
  });
}

/** Soft delete. The author removes their own post; an admin uses moderation. */
export async function deletePost(postId: string, userId: string) {
  const post = await db.post.findUnique({
    where: { id: postId },
    select: { userId: true, deletedAt: true },
  });
  if (!post || post.deletedAt) throw new PostError("Post not found", 404);
  if (post.userId !== userId) throw new PostError("Not your post", 403);

  return db.post.update({
    where: { id: postId },
    data: { deletedAt: new Date() },
  });
}

/** A provider's own posts, for the posts tab on their public profile. */
export async function listUserPosts(userId: string, viewerId: string | null) {
  const posts = await db.post.findMany({
    where: { ...PUBLIC_POST_WHERE, userId },
    orderBy: { createdAt: "desc" },
    take: FEED_PAGE_SIZE,
    select: FEED_SELECT,
  });

  const likedIds = viewerId
    ? new Set(
        (
          await db.like.findMany({
            where: { userId: viewerId, postId: { in: posts.map((p) => p.id) } },
            select: { postId: true },
          })
        ).map((l) => l.postId),
      )
    : new Set<string>();

  return posts.map((post) => ({
    ...post,
    likedByViewer: likedIds.has(post.id),
  }));
}
