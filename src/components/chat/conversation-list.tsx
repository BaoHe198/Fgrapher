"use client";

import { MessageCircle, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { formatDayMonth } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ConversationSummary {
  id: string;
  otherUser: {
    id: string;
    name: string | null;
    firstName: string | null;
    avatar: string | null;
    username: string | null;
  };
  lastMessage: {
    content: string;
    type: string;
    senderId: string;
    createdAt: string;
  } | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

function partyName(
  user: ConversationSummary["otherUser"],
  unknownLabel: string,
) {
  return user.firstName ?? user.name ?? unknownLabel;
}

function relativeTime(
  dateIso: string,
  labels: { now: string; yesterday: string },
) {
  const diffMs = Date.now() - new Date(dateIso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return labels.now;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return labels.yesterday;
  if (days < 7) return `${days}d`;
  return formatDayMonth(dateIso);
}

function previewText(
  message: ConversationSummary["lastMessage"],
  userId: string,
  labels: {
    noMessages: string;
    you: string;
    sentPhoto: string;
    sentBooking: string;
  },
) {
  if (!message) return labels.noMessages;
  const prefix = message.senderId === userId ? labels.you : "";
  if (message.type === "image") return `${prefix}${labels.sentPhoto}`;
  if (message.type === "booking_link") return `${prefix}${labels.sentBooking}`;
  return `${prefix}${message.content}`;
}

export function ConversationList({
  conversations,
  selectedId,
  currentUserId,
  onSelect,
  // The floating MessagingPopup already shows a "Tin nhắn" title in its own
  // header bar directly above this component — the full /dashboard/messages
  // page has no other heading, so it keeps this one by default.
  showHeading = true,
}: {
  conversations: ConversationSummary[];
  selectedId: string | null;
  currentUserId: string;
  onSelect: (id: string) => void;
  showHeading?: boolean;
}) {
  const t = useTranslations("sharedComponents.conversationList");
  const [query, setQuery] = useState("");
  const unknownLabel = t("unknown");

  const filtered = useMemo(() => {
    if (!query.trim()) return conversations;
    const q = query.toLowerCase();
    return conversations.filter((c) =>
      partyName(c.otherUser, unknownLabel).toLowerCase().includes(q),
    );
  }, [conversations, query, unknownLabel]);

  return (
    <div className="flex h-full flex-col overflow-hidden border-r border-border-subtle">
      <div className="flex flex-col gap-3 border-b border-border-subtle p-4">
        {showHeading ? (
          <h2 className="text-heading-lg text-text-primary">{t("title")}</h2>
        ) : null}
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-tertiary" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <MessageCircle className="size-10 text-text-tertiary" />
            <p className="text-body-md font-semibold! text-text-primary">
              {t("emptyTitle")}
            </p>
            <p className="text-body-sm text-text-secondary">
              {t("emptySubtitle")}
            </p>
          </div>
        ) : (
          filtered.map((conversation) => {
            const isSelected = conversation.id === selectedId;
            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => onSelect(conversation.id)}
                className={cn(
                  "flex w-full items-center gap-3 p-3.5 text-left",
                  isSelected ? "bg-success-bg" : "hover:bg-bg-sunken",
                )}
              >
                <Avatar className="size-11">
                  {conversation.otherUser.avatar ? (
                    <AvatarImage src={conversation.otherUser.avatar} alt="" />
                  ) : null}
                  <AvatarFallback>
                    {partyName(
                      conversation.otherUser,
                      unknownLabel,
                    )[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-body-md font-semibold! text-text-primary">
                      {partyName(conversation.otherUser, unknownLabel)}
                    </span>
                  </div>
                  <p className="truncate text-body-sm text-text-secondary">
                    {previewText(conversation.lastMessage, currentUserId, {
                      noMessages: t("noMessages"),
                      you: t("youPrefix"),
                      sentPhoto: t("sentPhoto"),
                      sentBooking: t("sentBooking"),
                    })}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1">
                  {conversation.lastMessageAt ? (
                    <span className="text-body-sm text-text-tertiary">
                      {relativeTime(conversation.lastMessageAt, {
                        now: t("now"),
                        yesterday: t("yesterday"),
                      })}
                    </span>
                  ) : null}
                  {conversation.unreadCount > 0 ? (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-primary px-1.5 text-sm font-bold text-text-on-brand">
                      {conversation.unreadCount}
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
