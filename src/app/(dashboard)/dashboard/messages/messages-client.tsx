"use client";

import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";

import { usePolling } from "@/hooks/use-polling";
import { ChatPanel } from "@/components/chat/chat-panel";
import {
  ConversationList,
  type ConversationSummary,
} from "@/components/chat/conversation-list";
import { MessagesSkeleton } from "@/components/chat/messages-skeleton";
import { cn } from "@/lib/utils";

export function MessagesClient({
  initialConversations,
}: {
  initialConversations: ConversationSummary[];
}) {
  const t = useTranslations("dashboardCore.messages");
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [conversations, setConversations] =
    useState<ConversationSummary[]>(initialConversations);
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

  // The first page already arrived via SSR (see page.tsx). usePolling would
  // normally fetch immediately on mount, which here would just re-fetch what
  // the server already sent — `skipInitialRun` keeps that saved round trip
  // while still pausing on hidden tabs and catching up on resume.
  usePolling(loadConversations, { intervalMs: 15_000, skipInitialRun: true });

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

  // QA: this used to just return null here — SessionProvider isn't
  // seeded with an SSR session (see auth-provider.tsx), so useSession()
  // genuinely fetches client-side even after the server-rendered page
  // (with its real initialConversations) has already mounted, producing
  // a second blank flash right after loading.tsx's skeleton resolved.
  // Same skeleton shape covers this shorter second window too.
  if (!session?.user) {
    return (
      <>
        <h1 className="sr-only">{t("pageTitle")}</h1>
        <MessagesSkeleton />
      </>
    );
  }

  return (
    <>
      {/* QA: this page had no <h1> anywhere — a chat-style layout (list +
          panel) genuinely doesn't need a big visible page title the way
          other dashboard pages do, but a screen reader still needs one. */}
      <h1 className="sr-only">{t("pageTitle")}</h1>
      <div className="grid h-[calc(100dvh-140px)] min-h-[480px] grid-cols-1 overflow-hidden rounded-[var(--fg-radius-lg)] border border-border-subtle bg-surface-card lg:h-[calc(100dvh-180px)] lg:grid-cols-[340px_1fr]">
        <div
          className={cn(
            "h-full min-h-0",
            selectedId ? "hidden lg:block" : "block",
          )}
        >
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            currentUserId={session.user.id}
            onSelect={onSelect}
          />
        </div>

        <div
          className={cn(
            "h-full min-h-0",
            selectedId ? "block" : "hidden lg:block",
          )}
        >
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
              <p className="text-body-lg font-semibold! text-text-primary">
                {t("selectConversation")}
              </p>
              <p className="text-body-md text-text-secondary">
                {t("selectConversationHint")}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
