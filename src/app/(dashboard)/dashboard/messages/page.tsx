"use client";

import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";

import { ChatPanel } from "@/components/chat/chat-panel";
import {
  ConversationList,
  type ConversationSummary,
} from "@/components/chat/conversation-list";
import { cn } from "@/lib/utils";

export default function MessagesPage() {
  const t = useTranslations("dashboardCore.messages");
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const startedRef = useRef(false);

  const loadConversations = () => {
    fetch("/api/conversations")
      .then((res) => res.json())
      .then((body) => {
        startTransition(() => {
          setConversations(body.data ?? []);
        });
      });
  };

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 15_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const to = searchParams.get("to");
    const c = searchParams.get("c");

    if (to && !startedRef.current) {
      startedRef.current = true;
      fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: to }),
      })
        .then((res) => res.json())
        .then((body) => {
          if (body.data?.id) {
            setSelectedId(body.data.id);
            router.replace(`/dashboard/messages?c=${body.data.id}`);
            loadConversations();
          }
        });
      return;
    }

    if (c) startTransition(() => setSelectedId(c));
    // Only searchParams is a real trigger here (startedRef guards the `to`
    // branch from firing twice) — router and loadConversations are stable/
    // re-created every render but including them wouldn't change when this
    // actually re-runs, only cause needless extra runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const selectedConversation = conversations.find((c) => c.id === selectedId);

  const onSelect = (id: string) => {
    setSelectedId(id);
    router.replace(`/dashboard/messages?c=${id}`);
  };

  const onBack = () => {
    setSelectedId(null);
    router.replace("/dashboard/messages");
  };

  if (!session?.user) return null;

  return (
    <div className="grid h-[calc(100dvh-180px)] min-h-[480px] grid-cols-1 overflow-hidden rounded-[var(--fg-radius-lg)] border border-border-subtle bg-surface-card lg:grid-cols-[340px_1fr]">
      <div className={cn("h-full", selectedId ? "hidden lg:block" : "block")}>
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          currentUserId={session.user.id}
          onSelect={onSelect}
        />
      </div>

      <div className={cn("h-full", selectedId ? "block" : "hidden lg:block")}>
        {selectedConversation ? (
          <ChatPanel
            key={selectedConversation.id}
            conversationId={selectedConversation.id}
            currentUserId={session.user.id}
            otherUser={selectedConversation.otherUser}
            onBack={onBack}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <MessageCircle className="size-16 text-text-tertiary" />
            <p className="text-body-lg font-semibold text-text-primary">
              {t("selectConversation")}
            </p>
            <p className="text-body-md text-text-secondary">
              {t("selectConversationHint")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
