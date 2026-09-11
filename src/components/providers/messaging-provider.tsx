"use client";

import { useSession } from "next-auth/react";
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { MessagingPopup } from "@/components/messaging/messaging-popup";
import { usePolling } from "@/hooks/use-polling";

interface MessagingContextValue {
  isOpen: boolean;
  isMinimized: boolean;
  selectedConversationId: string | null;
  unreadCount: number;
  open: (conversationId?: string) => void;
  close: () => void;
  toggle: () => void;
  minimize: () => void;
  restore: () => void;
}

const MessagingContext = createContext<MessagingContextValue | null>(null);

export function useMessaging() {
  const ctx = useContext(MessagingContext);
  if (!ctx) {
    throw new Error("useMessaging must be used within MessagingProvider");
  }
  return ctx;
}

// Prompt F4 — a floating popup reachable from every page, not just
// /dashboard/messages. This provider owns the open/minimized/selected
// state and the shared unread-count poll (previously duplicated per-hook
// in use-unread-messages.ts) so the header badge and the popup itself
// never disagree. Only mounted for authenticated sessions (VIỆC "Panel
// chỉ render khi người dùng đã đăng nhập").
export function MessagingProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(() => {
    if (status !== "authenticated") return;
    return fetch("/api/conversations/unread-count")
      .then((res) => res.json())
      .then((body) => {
        startTransition(() => setUnreadCount(body.data?.count ?? 0));
      })
      .catch(() => {});
  }, [status]);

  // A header badge nobody is looking at does not need refreshing; this used
  // to keep counting every 20s in backgrounded tabs.
  usePolling(loadUnreadCount, {
    intervalMs: 20_000,
    enabled: status === "authenticated",
  });

  const open = useCallback((conversationId?: string) => {
    setIsOpen(true);
    setIsMinimized(false);
    if (conversationId) setSelectedConversationId(conversationId);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setIsMinimized(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      if (prev) return false;
      setIsMinimized(false);
      return true;
    });
  }, []);

  const minimize = useCallback(() => setIsMinimized(true), []);
  const restore = useCallback(() => setIsMinimized(false), []);

  const value = useMemo(
    () => ({
      isOpen,
      isMinimized,
      selectedConversationId,
      unreadCount,
      open,
      close,
      toggle,
      minimize,
      restore,
    }),
    [
      isOpen,
      isMinimized,
      selectedConversationId,
      unreadCount,
      open,
      close,
      toggle,
      minimize,
      restore,
    ],
  );

  return (
    <MessagingContext.Provider value={value}>
      {children}
      {status === "authenticated" ? (
        <MessagingPopup
          isOpen={isOpen}
          isMinimized={isMinimized}
          selectedConversationId={selectedConversationId}
          onSelectConversation={setSelectedConversationId}
          onClose={close}
          onMinimize={minimize}
          onRestore={restore}
        />
      ) : null}
    </MessagingContext.Provider>
  );
}
