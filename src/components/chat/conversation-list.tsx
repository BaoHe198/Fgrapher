"use client";

import { MessageCircle, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
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
  lastMessage: { content: string; type: string; senderId: string; createdAt: string } | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

function partyName(user: ConversationSummary["otherUser"]) {
  return user.firstName ?? user.name ?? "Unknown";
}

function relativeTime(dateIso: string) {
  const diffMs = Date.now() - new Date(dateIso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d`;
  return new Date(dateIso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function previewText(message: ConversationSummary["lastMessage"], userId: string) {
  if (!message) return "No messages yet";
  const prefix = message.senderId === userId ? "You: " : "";
  if (message.type === "image") return `${prefix}Sent a photo`;
  if (message.type === "booking_link") return `${prefix}Sent a booking request`;
  return `${prefix}${message.content}`;
}

export function ConversationList({
  conversations,
  selectedId,
  currentUserId,
  onSelect,
}: {
  conversations: ConversationSummary[];
  selectedId: string | null;
  currentUserId: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return conversations;
    const q = query.toLowerCase();
    return conversations.filter((c) => partyName(c.otherUser).toLowerCase().includes(q));
  }, [conversations, query]);

  return (
    <div className="flex h-full flex-col overflow-hidden border-r border-border-subtle">
      <div className="flex flex-col gap-3 border-b border-border-subtle p-4">
        <h2 className="text-heading-lg text-text-primary">Messages</h2>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-tertiary" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations"
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <MessageCircle className="size-10 text-text-tertiary" />
            <p className="text-body-md font-semibold text-text-primary">No conversations yet</p>
            <p className="text-body-sm text-text-secondary">Message an artist to start</p>
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
                  <AvatarFallback>{partyName(conversation.otherUser)[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-body-md font-semibold text-text-primary">
                      {partyName(conversation.otherUser)}
                    </span>
                  </div>
                  <p className="truncate text-body-sm text-text-secondary">
                    {previewText(conversation.lastMessage, currentUserId)}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1">
                  {conversation.lastMessageAt ? (
                    <span className="text-body-sm text-text-tertiary">
                      {relativeTime(conversation.lastMessageAt)}
                    </span>
                  ) : null}
                  {conversation.unreadCount > 0 ? (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-primary px-1.5 text-xs font-bold text-text-on-brand">
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
