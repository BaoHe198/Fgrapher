"use client";

import { useSession } from "next-auth/react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { MessagingPopup } from "@/components/messaging/messaging-popup";
import { useBadges } from "@/components/providers/badges-provider";

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
// state. The unread count it hands out comes from BadgesProvider, which
// fetches it together with the bell's and the cart's numbers in one request
// (it used to poll /api/conversations/unread-count here, on its own). Only
// mounted for authenticated sessions (VIỆC "Panel chỉ render khi người dùng
// đã đăng nhập").
export function MessagingProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const { unreadMessages: unreadCount } = useBadges();

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
