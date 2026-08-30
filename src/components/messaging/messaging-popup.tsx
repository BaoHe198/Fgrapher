"use client";

import { Maximize2, MessageCircle, Minus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { startTransition, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ChatPanel } from "@/components/chat/chat-panel";
import {
  ConversationList,
  type ConversationSummary,
} from "@/components/chat/conversation-list";
import { Z_INDEX } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface MessagingPopupProps {
  isOpen: boolean;
  isMinimized: boolean;
  selectedConversationId: string | null;
  onSelectConversation: (id: string | null) => void;
  onClose: () => void;
  onMinimize: () => void;
  onRestore: () => void;
}

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// Prompt F4 — the floating messages popup, reachable from every page via
// the header icon (see web-nav.tsx). Desktop (>=sm): a non-modal panel
// bottom-right — no backdrop, so it never blocks interaction with the
// rest of the page (VIỆC "không chặn tương tác với trang"). Mobile
// (<sm): a full-screen takeover (VIỆC "bottom sheet chiếm toàn màn
// hình"), which — unlike the desktop panel — is fine to be modal-ish
// since there's no room to show both at once anyway.
export function MessagingPopup({
  isOpen,
  isMinimized,
  selectedConversationId,
  onSelectConversation,
  onClose,
  onMinimize,
  onRestore,
}: MessagingPopupProps) {
  const t = useTranslations("sharedComponents.messagingPopup");
  const { data: session } = useSession();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  const loadConversations = () => {
    fetch("/api/conversations")
      .then((res) => res.json())
      .then((body) => {
        startTransition(() => setConversations(body.data ?? []));
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!isOpen) return;
    loadConversations();
    const interval = setInterval(loadConversations, 15_000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Escape-to-close + a lightweight Tab-cycle focus trap — non-modal, so
  // this only intercepts keys while focus is already inside the panel,
  // never blocking clicks/keys elsewhere on the page.
  useEffect(() => {
    if (!isOpen || isMinimized) return;

    const panel = panelRef.current;
    const firstFocusable =
      panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    firstFocusable?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isMinimized, onClose]);

  if (!isOpen || !session?.user) return null;

  const selectedConversation = conversations.find(
    (c) => c.id === selectedConversationId,
  );

  const body = selectedConversation ? (
    <ChatPanel
      key={selectedConversation.id}
      conversationId={selectedConversation.id}
      currentUserId={session.user.id}
      otherUser={selectedConversation.otherUser}
      onBack={() => onSelectConversation(null)}
    />
  ) : (
    <ConversationList
      conversations={conversations}
      selectedId={null}
      currentUserId={session.user.id}
      onSelect={onSelectConversation}
    />
  );

  const header = (
    <div className="flex shrink-0 items-center gap-2 border-b border-border-subtle px-3.5 py-2.5">
      <MessageCircle className="size-4 text-brand-primary" />
      <span className="text-body-md font-semibold! text-text-primary">
        {t("title")}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          nativeButton={false}
          render={<Link href="/dashboard/messages" onClick={onClose} />}
          aria-label={t("expandAria")}
        >
          <Maximize2 className="size-4" />
        </Button>
        {/* No docked/collapsed affordance on a full-screen mobile view —
            minimize only makes sense for the desktop floating panel. */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onMinimize}
          aria-label={t("minimizeAria")}
          className="hidden sm:inline-flex"
        >
          <Minus className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label={t("closeAria")}
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop / tablet — non-modal floating panel, >=sm only. */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-label={t("title")}
        style={{ zIndex: Z_INDEX.messagingPanel }}
        className={cn(
          "fixed right-4 bottom-4 hidden w-[360px] flex-col overflow-hidden rounded-[var(--fg-radius-lg)] border border-border-subtle bg-surface-card shadow-xl sm:flex",
          isMinimized ? "h-auto" : "h-[520px]",
        )}
      >
        {isMinimized ? (
          <button
            type="button"
            onClick={onRestore}
            className="flex items-center gap-2 px-3.5 py-2.5 text-left"
          >
            <MessageCircle className="size-4 text-brand-primary" />
            <span className="text-body-md font-semibold! text-text-primary">
              {t("title")}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              aria-label={t("closeAria")}
              className="ml-auto"
            >
              <X className="size-4" />
            </Button>
          </button>
        ) : (
          <>
            {header}
            <div className="min-h-0 flex-1">{body}</div>
          </>
        )}
      </div>

      {/* Mobile — full-screen takeover, <sm only. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("title")}
        style={{ zIndex: Z_INDEX.overlay }}
        className={cn(
          "fixed inset-0 flex flex-col bg-surface-card sm:hidden",
          isMinimized && "hidden",
        )}
      >
        {header}
        <div className="min-h-0 flex-1">{body}</div>
      </div>
    </>
  );
}
