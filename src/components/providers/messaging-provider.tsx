"use client";

import { useSession } from "next-auth/react";
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { MessagingPopup } from "@/components/messaging/messaging-popup";

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

  useEffect(() => {
    if (status !== "authenticated") return;
    const load = () => {
      fetch("/api/conversations/unread-count")
        .then((res) => res.json())
        .then((body) => {
          startTransition(() => setUnreadCount(body.data?.count ?? 0));
        })
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 20_000);
    return () => clearInterval(interval);
  }, [status]);

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
