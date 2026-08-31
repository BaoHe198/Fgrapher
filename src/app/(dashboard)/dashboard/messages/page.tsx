import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { listConversations } from "@/services/messaging";

import { MessagesClient } from "./messages-client";

export default async function MessagesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const conversations = await listConversations(session.user.id);

  // ConversationSummary (conversation-list.tsx) expects JSON-serialized
  // dates as strings — matches what the client's own polling fetch
  // already produces via res.json().
  const initialConversations = conversations.map((c) => ({
    ...c,
    lastMessage: c.lastMessage
      ? { ...c.lastMessage, createdAt: c.lastMessage.createdAt.toISOString() }
      : null,
    lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
  }));

  return <MessagesClient initialConversations={initialConversations} />;
}
