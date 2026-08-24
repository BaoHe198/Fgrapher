import { db } from "@/lib/db";
import { notify } from "@/services/notification";

const PAGE_SIZE = 20;
const MESSAGES_PAGE_SIZE = 30;

const PARTY_SELECT = {
  id: true,
  name: true,
  firstName: true,
  avatar: true,
  username: true,
} as const;

export class MessagingError extends Error {
  constructor(
    message: string,
    public status: 400 | 403 | 404,
  ) {
    super(message);
    this.name = "MessagingError";
  }
}

export async function isBlocked(userId: string, otherUserId: string) {
  const block = await db.blockedUser.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: otherUserId },
        { blockerId: otherUserId, blockedId: userId },
      ],
    },
  });
  return Boolean(block);
}

export async function listConversations(userId: string, page = 1) {
  const participantRows = await db.conversationParticipant.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          participants: { include: { user: { select: PARTY_SELECT } } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
    orderBy: { conversation: { lastMessageAt: "desc" } },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  // One batched groupBy for the whole page instead of a per-conversation
  // db.message.count() in the loop below — this list is polled from
  // /dashboard/messages, so avoiding N+1 here matters more than most reads.
  const unreadRows = await db.message.groupBy({
    by: ["conversationId"],
    where: {
      conversationId: { in: participantRows.map((row) => row.conversationId) },
      receiverId: userId,
      readAt: null,
    },
    _count: true,
  });
  const unreadByConversation = new Map(
    unreadRows.map((r) => [r.conversationId, r._count]),
  );

  const results = participantRows.map((row) => {
    const other = row.conversation.participants.find(
      (p) => p.userId !== userId,
    )?.user;
    const lastMessage = row.conversation.messages[0] ?? null;

    return {
      id: row.conversation.id,
      otherUser: other ?? null,
      lastMessage,
      lastMessageAt: row.conversation.lastMessageAt,
      unreadCount: unreadByConversation.get(row.conversationId) ?? 0,
    };
  });

  return results.filter((r) => r.otherUser !== null);
}

export async function getUnreadConversationCount(userId: string) {
  const rows = await db.message.groupBy({
    by: ["conversationId"],
    where: { receiverId: userId, readAt: null },
  });
  return rows.length;
}

export async function getOrCreateConversation(
  userId: string,
  otherUserId: string,
) {
  if (userId === otherUserId) {
    throw new MessagingError("You can't message yourself", 400);
  }

  const otherUser = await db.user.findUnique({
    where: { id: otherUserId, deletedAt: null },
  });
  if (!otherUser) {
    throw new MessagingError("User not found", 404);
  }

  if (await isBlocked(userId, otherUserId)) {
    throw new MessagingError("You can't message this user", 403);
  }

  const existing = await db.conversationParticipant.findFirst({
    where: {
      userId,
      conversation: { participants: { some: { userId: otherUserId } } },
    },
    select: { conversationId: true },
  });

  if (existing) return existing.conversationId;

  const conversation = await db.conversation.create({
    data: {
      participants: {
        createMany: { data: [{ userId }, { userId: otherUserId }] },
      },
    },
  });

  return conversation.id;
}

async function requireParticipant(conversationId: string, userId: string) {
  const participant = await db.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!participant) {
    throw new MessagingError("You are not part of this conversation", 403);
  }
  return participant;
}

export async function listMessages({
  conversationId,
  userId,
  cursor,
}: {
  conversationId: string;
  userId: string;
  cursor?: string;
}) {
  await requireParticipant(conversationId, userId);

  const messages = await db.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: MESSAGES_PAGE_SIZE,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  // Message.bookingId is a loose scalar reference (no formal Prisma
  // relation to Booking, to avoid coupling the two models together) — so
  // booking_link summaries are fetched separately and merged in.
  const bookingIds = messages
    .map((m) => m.bookingId)
    .filter((id): id is string => Boolean(id));
  const bookings = bookingIds.length
    ? await db.booking.findMany({
        where: { id: { in: bookingIds } },
        select: {
          id: true,
          date: true,
          startTime: true,
          status: true,
          service: { select: { name: true } },
        },
      })
    : [];
  const bookingById = new Map(bookings.map((b) => [b.id, b]));

  return messages.reverse().map((m) => ({
    ...m,
    booking: m.bookingId ? (bookingById.get(m.bookingId) ?? null) : null,
  }));
}

export async function sendMessage({
  conversationId,
  senderId,
  content,
  type = "text",
  mediaUrl,
  bookingId,
}: {
  conversationId: string;
  senderId: string;
  content: string;
  type?: string;
  mediaUrl?: string;
  bookingId?: string;
}) {
  await requireParticipant(conversationId, senderId);

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: true },
  });
  if (!conversation) throw new MessagingError("Conversation not found", 404);

  const receiverId = conversation.participants.find(
    (p) => p.userId !== senderId,
  )?.userId;
  if (!receiverId)
    throw new MessagingError("Conversation has no other participant", 400);

  if (await isBlocked(senderId, receiverId)) {
    throw new MessagingError("You can't message this user", 403);
  }

  const [message] = await db.$transaction([
    db.message.create({
      data: {
        conversationId,
        senderId,
        receiverId,
        content,
        type,
        mediaUrl,
        bookingId,
      },
      include: { sender: { select: PARTY_SELECT } },
    }),
    db.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    }),
  ]);

  const sender = await db.user.findUnique({
    where: { id: senderId },
    select: PARTY_SELECT,
  });

  // No live real-time transport in this environment (Pusher/Socket.io need
  // credentials this project doesn't have) — the chat panel polls for new
  // messages instead. This just handles the "recipient isn't looking"
  // case: in-app + email notification, same as any other notify() call.
  await notify({
    userId: receiverId,
    type: "NEW_MESSAGE",
    title: `New message from ${sender?.firstName ?? sender?.name ?? "someone"}`,
    message: type === "image" ? "Sent a photo" : content.slice(0, 140),
    data: { conversationId },
  });

  return message;
}

export async function markConversationRead(
  conversationId: string,
  userId: string,
) {
  await requireParticipant(conversationId, userId);

  await db.$transaction([
    db.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    }),
    db.message.updateMany({
      where: { conversationId, receiverId: userId, readAt: null },
      data: { readAt: new Date() },
    }),
  ]);
}

export async function blockUser(
  blockerId: string,
  blockedId: string,
  reason?: string,
) {
  if (blockerId === blockedId)
    throw new MessagingError("You can't block yourself", 400);
  await db.blockedUser.upsert({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    create: { blockerId, blockedId, reason },
    update: { reason },
  });
}

export async function unblockUser(blockerId: string, blockedId: string) {
  await db.blockedUser.deleteMany({ where: { blockerId, blockedId } });
}
