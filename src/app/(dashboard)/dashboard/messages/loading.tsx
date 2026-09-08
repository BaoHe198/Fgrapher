import { MessagesSkeleton } from "@/components/chat/messages-skeleton";

// QA: messages showed a blank white screen + spinner for ~2s while
// page.tsx's listConversations() query resolves server-side — the
// dashboard route group's generic loading.tsx (a small centered
// spinner) doesn't hold any of this page's actual shape. This route-
// specific loading.tsx takes precedence over that one.
export default function MessagesLoading() {
  return <MessagesSkeleton />;
}
