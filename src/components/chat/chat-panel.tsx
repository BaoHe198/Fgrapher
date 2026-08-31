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
import { useTranslations } from "next-intl";
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
import { formatDate, formatDayMonthLong, formatTime } from "@/lib/format";
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
  EXPIRED: "neutral",
};

function partyName(user: ChatPartner, unknownLabel: string) {
  return user.firstName ?? user.name ?? unknownLabel;
}

function dateSeparatorLabel(
  date: Date,
  labels: { today: string; yesterday: string },
) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(date, today)) return labels.today;
  if (isSameDay(date, yesterday)) return labels.yesterday;
  return formatDayMonthLong(date);
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
  // The full /dashboard/messages page shows the conversation list alongside
  // the chat at lg+ (so the back button there is redundant and stays
  // lg:hidden), but the floating MessagingPopup is a single narrow panel at
  // every viewport width — its own back button needs to stay visible
  // regardless of how wide the browser window is.
  alwaysShowBack = false,
}: {
  conversationId: string;
  currentUserId: string;
  otherUser: ChatPartner;
  onBack?: () => void;
  alwaysShowBack?: boolean;
}) {
  const t = useTranslations("sharedComponents.chatPanel");
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
  // A ref, not just the `sending` state, because two calls to onSend() in
  // the same tick (e.g. Enter-key handler firing twice) would both still
  // see the pre-update `sending` value — state updates aren't synchronous,
  // refs are.
  const isSendingRef = useRef(false);

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
    // the pragmatic stand-in while a conversation is open. 2s (was 4s) so
    // incoming messages from the other side feel closer to real-time; the
    // sender's own messages no longer wait on this poll at all (see onSend).
    const interval = setInterval(() => load(false), 2000);
    return () => clearInterval(interval);
    // `load` is a fresh closure every render but only truly depends on
    // conversationId, already listed — switching conversations reloads and
    // restarts the polling interval for the new one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const onSend = async (
    overrides?: Partial<{ content: string; type: string; mediaUrl: string }>,
  ) => {
    const content = overrides?.content ?? draft.trim();
    if (!content && !overrides?.mediaUrl) return;
    if (isSendingRef.current) return;
    isSendingRef.current = true;

    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          content: overrides?.content ?? draft.trim() ?? t("sentPhoto"),
          type: overrides?.type ?? "text",
          mediaUrl: overrides?.mediaUrl,
        }),
      });

      if (res.ok) {
        const body = await res.json();
        setDraft("");
        if (textareaRef.current) textareaRef.current.style.height = "auto";
        // Append the just-created message directly instead of waiting on
        // load(true)'s round-trip — the POST response already has the real,
        // persisted row, so there's nothing left to fetch. The next poll
        // reconciles it against the server's list like any other message.
        if (body.data) {
          setMessages((prev) => [...prev, body.data]);
          requestAnimationFrame(() =>
            bottomRef.current?.scrollIntoView({ block: "end" }),
          );
        }
      }
    } finally {
      isSendingRef.current = false;
      setSending(false);
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
      await onSend({ content: t("photo"), type: "image", mediaUrl: url });
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
          <button
            type="button"
            onClick={onBack}
            className={alwaysShowBack ? undefined : "lg:hidden"}
          >
            <ArrowLeft className="size-5 text-text-secondary" />
          </button>
        ) : null}
        <Avatar className="size-10">
          {otherUser.avatar ? (
            <AvatarImage src={otherUser.avatar} alt="" />
          ) : null}
          <AvatarFallback>
            {partyName(otherUser, t("unknown"))[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="flex-1 text-heading-sm text-text-primary">
          {partyName(otherUser, t("unknown"))}
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
                {t("viewProfile")}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={() => setReportOpen(true)}>
              {t("report")}
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
              {t("block")}
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
              {t("emptyState")}
            </p>
            <p className="max-w-xs text-body-sm text-text-tertiary">
              {t("safetyNote")}
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
                    {dateSeparatorLabel(date, {
                      today: t("today"),
                      yesterday: t("yesterday"),
                    })}
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
                        <span className="text-body-sm font-semibold! text-text-primary">
                          {message.booking.service?.name ?? t("bookingRequest")}
                        </span>
                      </div>
                      <span className="text-body-sm text-text-secondary">
                        {formatDate(message.booking.date)} ·{" "}
                        {message.booking.startTime}
                      </span>
                      <Badge
                        variant={BOOKING_STATUS_VARIANT[message.booking.status]}
                        className="w-fit"
                      >
                        {message.booking.status}
                      </Badge>
                      <span className="text-body-sm font-semibold! text-brand-primary">
                        {t("viewBooking")}
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

                  <div className="mt-1 flex items-center gap-1 text-caption text-text-tertiary">
                    <span>{formatTime(date)}</span>
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
          aria-label={t("attachImage")}
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
          placeholder={t("writeMessage")}
          className="max-h-[120px] min-h-10 flex-1 resize-none rounded-[var(--fg-radius-md)] border border-border-default bg-bg-surface px-3.5 py-2.5 text-body-md text-text-primary outline-none focus-visible:border-border-focus focus-visible:ring-2 focus-visible:ring-gold-500/20"
        />
        <Button
          variant="accent"
          size="icon"
          className="rounded-full"
          disabled={!draft.trim() || sending}
          aria-label={t("sendMessage")}
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
