"use client";

import type { BookingStatus } from "@prisma/client";
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCheck,
  ImagePlus,
  Loader2,
  MessageCircle,
  MoreVertical,
  Send,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { startTransition, useEffect, useRef, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MediaLightbox } from "@/components/modals/media-lightbox";
import { ReportModal } from "@/components/modals/report-modal";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: string;
  mediaUrl: string | null;
  bookingId: string | null;
  readAt: string | null;
  createdAt: string;
  booking: {
    id: string;
    date: string;
    startTime: string;
    status: BookingStatus;
    service: { name: string } | null;
  } | null;
}

interface ChatPartner {
  id: string;
  name: string | null;
  firstName: string | null;
  avatar: string | null;
  username: string | null;
}

const BOOKING_STATUS_VARIANT: Record<
  BookingStatus,
  "warning" | "success" | "neutral" | "destructive"
> = {
  PENDING: "warning",
  CONFIRMED: "success",
  COMPLETED: "neutral",
  CANCELLED: "destructive",
  DECLINED: "destructive",
  NO_SHOW: "destructive",
};

function partyName(user: ChatPartner) {
  return user.firstName ?? user.name ?? "Unknown";
}

function dateSeparatorLabel(date: Date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString("en-US", { day: "numeric", month: "long" });
}

async function uploadImage(file: File): Promise<string | null> {
  const sigRes = await fetch("/api/upload/signature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purpose: "chat" }),
  });
  const sigBody = await sigRes.json();
  if (!sigRes.ok) return null;

  const { cloudName, apiKey, timestamp, signature, folder, transformation } =
    sigBody.data;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", apiKey);
  formData.append("timestamp", timestamp);
  formData.append("signature", signature);
  formData.append("folder", folder);
  formData.append("transformation", transformation);

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    {
      method: "POST",
      body: formData,
    },
  );
  const uploadBody = await uploadRes.json();
  return uploadRes.ok ? uploadBody.secure_url : null;
}

export function ChatPanel({
  conversationId,
  currentUserId,
  otherUser,
  onBack,
}: {
  conversationId: string;
  currentUserId: string;
  otherUser: ChatPartner;
  onBack?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async (scrollToBottom: boolean) => {
    const res = await fetch(`/api/conversations/${conversationId}/messages`);
    const body = await res.json();
    startTransition(() => {
      setMessages(body.data ?? []);
      setIsLoading(false);
    });
    if (scrollToBottom) {
      requestAnimationFrame(() =>
        bottomRef.current?.scrollIntoView({ block: "end" }),
      );
    }
    fetch(`/api/conversations/${conversationId}/read`, { method: "PATCH" });
  };

  useEffect(() => {
    startTransition(() => setIsLoading(true));
    load(true);
    // No live transport (Pusher/Socket.io) in this environment — polling is
    // the pragmatic stand-in while a conversation is open.
    const interval = setInterval(() => load(false), 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const onSend = async (
    overrides?: Partial<{ content: string; type: string; mediaUrl: string }>,
  ) => {
    const content = overrides?.content ?? draft.trim();
    if (!content && !overrides?.mediaUrl) return;

    setSending(true);
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        content: overrides?.content ?? draft.trim() ?? "Sent a photo",
        type: overrides?.type ?? "text",
        mediaUrl: overrides?.mediaUrl,
      }),
    });
    setSending(false);

    if (res.ok) {
      setDraft("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      load(true);
    }
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    const url = await uploadImage(file);
    setUploading(false);
    if (url) {
      await onSend({ content: "Photo", type: "image", mediaUrl: url });
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  let lastDateKey = "";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border-subtle p-4">
        {onBack ? (
          <button type="button" onClick={onBack} className="lg:hidden">
            <ArrowLeft className="size-5 text-text-secondary" />
          </button>
        ) : null}
        <Avatar className="size-10">
          {otherUser.avatar ? (
            <AvatarImage src={otherUser.avatar} alt="" />
          ) : null}
          <AvatarFallback>
            {partyName(otherUser)[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="flex-1 text-heading-sm text-text-primary">
          {partyName(otherUser)}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm">
                <MoreVertical className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            {otherUser.username ? (
              <DropdownMenuItem
                render={<Link href={`/profile/${otherUser.username}`} />}
              >
                View profile
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={() => setReportOpen(true)}>
              Report
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() =>
                fetch("/api/blocks", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ userId: otherUser.id }),
                })
              }
            >
              Block
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ReportModal
          open={reportOpen}
          onOpenChange={setReportOpen}
          targetType="user"
          targetId={otherUser.id}
        />
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-text-tertiary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <MessageCircle className="size-10 text-text-tertiary" />
            <p className="text-body-md text-text-secondary">
              Say hello to start the conversation
            </p>
            <p className="max-w-xs text-body-sm text-text-tertiary">
              Stay safe: never share payment details outside Fgrapher. Report
              anything suspicious.
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwn = message.senderId === currentUserId;
            const date = new Date(message.createdAt);
            const dateKey = date.toDateString();
            const showSeparator = dateKey !== lastDateKey;
            lastDateKey = dateKey;

            return (
              <div key={message.id} className="flex flex-col gap-3">
                {showSeparator ? (
                  <div className="flex items-center gap-3 text-body-sm text-text-tertiary">
                    <div className="h-px flex-1 bg-border-subtle" />
                    {dateSeparatorLabel(date)}
                    <div className="h-px flex-1 bg-border-subtle" />
                  </div>
                ) : null}

                <div
                  className={cn(
                    "flex flex-col",
                    isOwn ? "items-end" : "items-start",
                  )}
                >
                  {message.type === "booking_link" && message.booking ? (
                    <Link
                      href={`/dashboard/bookings/${message.booking.id}`}
                      className="flex w-full max-w-[320px] flex-col gap-2 rounded-[16px] border border-border-subtle bg-surface-card p-3.5"
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="size-4 text-brand-primary" />
                        <span className="text-body-sm font-semibold text-text-primary">
                          {message.booking.service?.name ?? "Booking request"}
                        </span>
                      </div>
                      <span className="text-body-sm text-text-secondary">
                        {new Date(message.booking.date).toLocaleDateString(
                          "en-US",
                          {
                            dateStyle: "medium",
                            timeZone: "UTC",
                          },
                        )}{" "}
                        · {message.booking.startTime}
                      </span>
                      <Badge
                        variant={BOOKING_STATUS_VARIANT[message.booking.status]}
                        className="w-fit"
                      >
                        {message.booking.status}
                      </Badge>
                      <span className="text-body-sm font-semibold text-brand-primary">
                        View booking
                      </span>
                    </Link>
                  ) : message.type === "image" && message.mediaUrl ? (
                    <button
                      type="button"
                      onClick={() => setLightboxUrl(message.mediaUrl)}
                    >
                      <Image
                        src={message.mediaUrl}
                        alt=""
                        width={280}
                        height={280}
                        className="max-w-[280px] rounded-[16px] object-cover"
                      />
                    </button>
                  ) : (
                    <div
                      className={cn(
                        "max-w-[70%] px-4 py-2.5 text-body-md",
                        isOwn
                          ? "rounded-[16px_16px_4px_16px] bg-brand-primary text-text-on-brand"
                          : "rounded-[16px_16px_16px_4px] border border-border-subtle bg-surface-card text-text-primary",
                      )}
                    >
                      {message.content}
                    </div>
                  )}

                  <div className="mt-1 flex items-center gap-1 text-xs text-text-tertiary">
                    <span>
                      {date.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    {isOwn ? (
                      message.readAt ? (
                        <CheckCheck className="size-3.5 text-gold-400" />
                      ) : (
                        <Check className="size-3.5" />
                      )
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-end gap-2 border-t border-border-subtle p-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileSelected}
        />
        <Button
          variant="ghost"
          size="icon"
          disabled={uploading}
          aria-label="Attach an image"
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ImagePlus className="size-4" />
          )}
        </Button>
        <textarea
          ref={textareaRef}
          rows={1}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
          }}
          onKeyDown={onKeyDown}
          placeholder="Write a message..."
          className="max-h-[120px] min-h-10 flex-1 resize-none rounded-[var(--fg-radius-md)] border border-border-default bg-bg-surface px-3.5 py-2.5 text-body-md text-text-primary outline-none focus-visible:border-border-focus focus-visible:ring-2 focus-visible:ring-gold-500/20"
        />
        <Button
          variant="accent"
          size="icon"
          className="rounded-full"
          disabled={!draft.trim() || sending}
          aria-label="Send message"
          onClick={() => onSend()}
        >
          {sending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </div>

      {lightboxUrl ? (
        <MediaLightbox
          items={[{ url: lightboxUrl }]}
          index={0}
          onClose={() => setLightboxUrl(null)}
          onIndexChange={() => {}}
        />
      ) : null}
    </div>
  );
}
