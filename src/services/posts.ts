import type { PostKind, Prisma } from "@prisma/client";

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
            where: {
              userId,
              kind: "STANDARD",
              createdAt: { gte: since },
              deletedAt: null,
            },
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
      kind: "STANDARD",
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
    include: {
      media: true,
      user: {
        select: {
          id: true,
          name: true,
          firstName: true,
          username: true,
          avatar: true,
        },
      },
    },
  });

  for (const item of post.media) void runPostMediaModeration(item.id);
  return post;
}

/** Create the one social identity an album keeps for its whole lifetime. */
export async function ensureAlbumSocialPost(albumId: string) {
  const album = await db.album.findUnique({
    where: { id: albumId },
    select: { id: true, profile: { select: { userId: true } } },
  });
  if (!album) return null;

  return db.post.upsert({
    where: { albumId },
    create: {
      userId: album.profile.userId,
      kind: "PORTFOLIO_ALBUM",
      albumId,
    },
    update: { deletedAt: null },
  });
}

/** Approved requests enter Community F once, then keep that post as status changes. */
export async function ensureServiceRequestSocialPost(serviceRequestId: string) {
  const request = await db.serviceRequest.findUnique({
    where: { id: serviceRequestId },
    select: { id: true, customerId: true, isDraft: true, status: true },
  });
  if (
    !request ||
    request.isDraft ||
    request.status === "PENDING_REVIEW" ||
    request.status === "REJECTED"
  ) {
    return null;
  }

  return db.post.upsert({
    where: { serviceRequestId },
    create: {
      userId: request.customerId,
      kind: "SERVICE_REQUEST",
      serviceRequestId,
    },
    update: { deletedAt: null },
  });
}

const PUBLIC_POST_WHERE: Prisma.PostWhereInput = {
  deletedAt: null,
  OR: [
    {
      kind: "STANDARD",
      OR: [
        { media: { none: {} } },
        { media: { some: { moderationStatus: "APPROVED" } } },
      ],
    },
    {
      kind: "PORTFOLIO_ALBUM",
      album: {
        is: {
          deletedAt: null,
          isPublished: true,
          media: {
            some: { moderationStatus: "APPROVED", deletedAt: null },
          },
        },
      },
    },
    {
      kind: "SERVICE_REQUEST",
      serviceRequest: {
        is: {
          isDraft: false,
          status: { notIn: ["PENDING_REVIEW", "REJECTED"] },
        },
      },
    },
  ],
};

const FEED_SELECT = {
  id: true,
  kind: true,
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
  album: {
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      profile: { select: { displayName: true } },
      media: {
        where: { moderationStatus: "APPROVED" as const, deletedAt: null },
        orderBy: { order: "asc" as const },
        select: { id: true, url: true, type: true, width: true, height: true },
      },
    },
  },
  serviceRequest: {
    select: {
      id: true,
      code: true,
      title: true,
      description: true,
      role: true,
      categories: true,
      shootDate: true,
      isDateFlexible: true,
      dateRangeStart: true,
      dateRangeEnd: true,
      budgetMin: true,
      budgetMax: true,
      currency: true,
      status: true,
      province: { select: { name: true } },
      ward: { select: { name: true } },
      references: { select: { id: true, mediaUrl: true } },
      _count: { select: { offers: true } },
    },
  },
} as const;

type SelectedPost = Prisma.PostGetPayload<{ select: typeof FEED_SELECT }>;

async function addViewerState(posts: SelectedPost[], viewerId: string | null) {
  const postIds = posts.map((post) => post.id);
  const requestIds = posts.flatMap((post) =>
    post.serviceRequest ? [post.serviceRequest.id] : [],
  );

  const [likedRows, viewerRoles, offers] = viewerId
    ? await Promise.all([
        db.like.findMany({
          where: { userId: viewerId, postId: { in: postIds } },
          select: { postId: true },
        }),
        db.userRole.findMany({
          where: {
            userId: viewerId,
            active: true,
            verificationStatus: "VERIFIED",
          },
          select: { role: true },
        }),
        db.requestOffer.findMany({
          where: {
            requestId: { in: requestIds },
            OR: [
              { providerId: viewerId },
              { request: { customerId: viewerId } },
            ],
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            requestId: true,
            providerId: true,
            message: true,
            proposedPrice: true,
            currency: true,
            proposedDate: true,
            status: true,
            createdAt: true,
            provider: {
              select: {
                id: true,
                name: true,
                firstName: true,
                username: true,
                avatar: true,
                profiles: {
                  where: { isPublished: true },
                  select: { displayName: true, role: true },
                  take: 1,
                },
              },
            },
          },
        }),
      ])
    : [[], [], []];

  const likedIds = new Set(likedRows.map((row) => row.postId));
  const roleSet = new Set(viewerRoles.map((row) => row.role));
  const offersByRequest = new Map<string, typeof offers>();
  for (const offer of offers) {
    const current = offersByRequest.get(offer.requestId) ?? [];
    current.push(offer);
    offersByRequest.set(offer.requestId, current);
  }

  return posts.map((post) => {
    const request = post.serviceRequest;
    const media =
      post.kind === "PORTFOLIO_ALBUM"
        ? (post.album?.media ?? [])
        : post.kind === "SERVICE_REQUEST"
          ? (request?.references.map((item) => ({
              id: item.id,
              url: item.mediaUrl,
              type: "IMAGE" as const,
              width: null,
              height: null,
            })) ?? [])
          : post.media;

    return {
      ...post,
      user:
        post.kind === "PORTFOLIO_ALBUM" && post.album?.profile.displayName
          ? {
              ...post.user,
              name: post.album.profile.displayName,
              firstName: null,
            }
          : post.user,
      media,
      album: post.album
        ? {
            id: post.album.id,
            title: post.album.title,
            description: post.album.description,
            category: post.album.category,
          }
        : null,
      likedByViewer: likedIds.has(post.id),
      serviceRequest: request
        ? {
            id: request.id,
            code: request.code,
            title: request.title,
            description: request.description,
            role: request.role,
            categories: request.categories,
            shootDate: request.shootDate,
            isDateFlexible: request.isDateFlexible,
            dateRangeStart: request.dateRangeStart,
            dateRangeEnd: request.dateRangeEnd,
            budgetMin: request.budgetMin,
            budgetMax: request.budgetMax,
            currency: request.currency,
            status: request.status,
            province: request.province,
            ward: request.ward,
            offerCount: request._count.offers,
            offers: offersByRequest.get(request.id) ?? [],
            canOffer:
              Boolean(viewerId) &&
              viewerId !== post.user.id &&
              roleSet.has(request.role) &&
              (request.status === "OPEN" || request.status === "HAS_OFFERS"),
          }
        : null,
    };
  });
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

export type FeedFilter = "all" | "posts" | "portfolio" | "bookings";

const FILTER_KIND: Record<Exclude<FeedFilter, "all">, PostKind> = {
  posts: "STANDARD",
  portfolio: "PORTFOLIO_ALBUM",
  bookings: "SERVICE_REQUEST",
};

export async function listFeed({
  viewerId,
  tab,
  filter = "all",
  cursor,
}: {
  viewerId: string | null;
  tab: "following" | "discover";
  filter?: FeedFilter;
  cursor?: string | null;
}) {
  const decoded = decodeCursor(cursor);
  const and: Prisma.PostWhereInput[] = [PUBLIC_POST_WHERE];

  if (filter !== "all") and.push({ kind: FILTER_KIND[filter] });
  if (decoded) {
    and.push({
      OR: [
        { createdAt: { lt: decoded.createdAt } },
        { createdAt: decoded.createdAt, id: { lt: decoded.id } },
      ],
    });
  }

  if (tab === "following") {
    if (!viewerId) return { data: [], nextCursor: null };
    const following = await db.follow.findMany({
      where: { followerId: viewerId },
      select: { followingId: true },
    });
    if (following.length === 0) return { data: [], nextCursor: null };
    and.push({ userId: { in: following.map((row) => row.followingId) } });
  }

  const posts = await db.post.findMany({
    relationLoadStrategy: "join",
    where: { AND: and },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: FEED_PAGE_SIZE + 1,
    select: FEED_SELECT,
  });

  const hasMore = posts.length > FEED_PAGE_SIZE;
  const page = hasMore ? posts.slice(0, FEED_PAGE_SIZE) : posts;
  return {
    data: await addViewerState(page, viewerId),
    nextCursor: hasMore ? encodeCursor(page[page.length - 1]) : null,
  };
}

export async function listAlbumSocialState(
  albumIds: string[],
  viewerId: string | null,
) {
  if (albumIds.length === 0) return [];
  const posts = await db.post.findMany({
    where: { albumId: { in: albumIds }, deletedAt: null },
    select: {
      id: true,
      albumId: true,
      likeCount: true,
      commentCount: true,
    },
  });
  const liked = viewerId
    ? await db.like.findMany({
        where: { userId: viewerId, postId: { in: posts.map((p) => p.id) } },
        select: { postId: true },
      })
    : [];
  const likedIds = new Set(liked.map((row) => row.postId));
  return posts.map((post) => ({
    ...post,
    likedByViewer: likedIds.has(post.id),
  }));
}

export async function toggleLike(postId: string, userId: string) {
  const post = await db.post.findFirst({
    where: { id: postId, AND: [PUBLIC_POST_WHERE] },
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
  const post = await db.post.findFirst({
    where: { id: postId, AND: [PUBLIC_POST_WHERE] },
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
  const post = await db.post.findFirst({
    where: { id: postId, AND: [PUBLIC_POST_WHERE] },
    select: { id: true },
  });
  if (!post) throw new PostError("Post not found", 404);

  return db.comment.findMany({
    where: { postId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    take: COMMENT_PAGE_SIZE,
    include: {
      user: { select: { id: true, name: true, firstName: true, avatar: true } },
    },
  });
}

export async function deletePost(postId: string, userId: string) {
  const post = await db.post.findUnique({
    where: { id: postId },
    select: { userId: true, kind: true, deletedAt: true },
  });
  if (!post || post.deletedAt) throw new PostError("Post not found", 404);
  if (post.userId !== userId) throw new PostError("Not your post", 403);
  if (post.kind !== "STANDARD") {
    throw new PostError("Manage this post from its original item", 409);
  }
  return db.post.update({
    where: { id: postId },
    data: { deletedAt: new Date() },
  });
}

/** Ordinary authored posts for the profile's Posts tab. Album engagement is shown in Portfolio. */
export async function listUserPosts(userId: string, viewerId: string | null) {
  const posts = await db.post.findMany({
    relationLoadStrategy: "join",
    where: { AND: [PUBLIC_POST_WHERE, { userId, kind: "STANDARD" }] },
    orderBy: { createdAt: "desc" },
    take: FEED_PAGE_SIZE,
    select: FEED_SELECT,
  });
  return addViewerState(posts, viewerId);
}

export async function countPendingPosts(userId: string) {
  return db.post.count({
    where: {
      userId,
      kind: "STANDARD",
      deletedAt: null,
      media: { some: {} },
      NOT: { media: { some: { moderationStatus: "APPROVED" } } },
    },
  });
}

/**
 * One post by id, for its permalink. Applies the same visibility rule as
 * the feed — a post whose only photo is still pending is not public — so a
 * shared link cannot expose what the feed hides. The author sees their own
 * either way, which is how they can check what is holding it up.
 */
export async function getPost(postId: string, viewerId: string | null) {
  const post = await db.post.findFirst({
    relationLoadStrategy: "join",
    where: {
      id: postId,
      deletedAt: null,
      // The author always sees their own — that is how they check what is
      // holding a post up — while everyone else gets the feed's rule.
      ...(viewerId
        ? {
            OR: [
              { userId: viewerId },
              { media: { none: {} } },
              { media: { some: { moderationStatus: "APPROVED" as const } } },
            ],
          }
        : { OR: PUBLIC_POST_WHERE.OR }),
    },
    select: FEED_SELECT,
  });
  if (!post) return null;

  const liked = viewerId
    ? await db.like.findUnique({
        where: { userId_postId: { userId: viewerId, postId } },
        select: { id: true },
      })
    : null;

  return { ...post, likedByViewer: Boolean(liked) };
}
