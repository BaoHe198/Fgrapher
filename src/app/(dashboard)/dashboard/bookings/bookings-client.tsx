"use client";

import type { Booking, User } from "@prisma/client";
import { Calendar, Loader2, MessageCircle, MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { BookingListItem } from "@/components/booking/booking-list-item";
import { useMessaging } from "@/components/providers/messaging-provider";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { useUserRoles } from "@/hooks/use-user-roles";
import type { BookingTab, BookingTabCounts } from "@/services/bookings";

type BookingParty = Pick<User, "id" | "name" | "firstName" | "avatar">;
type BookingRow = Booking & {
  customer: BookingParty;
  provider: BookingParty;
  service: { name: string } | null;
  review?: { id: string } | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const TAB_VALUES: BookingTab[] = [
  "ALL",
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
];

// "Lịch đặt" (redesign 09/2026): a list of booking cards rather than a
// table - on a phone the table had to collapse into cards anyway - with a
// count on every tab, a one-line summary under the title, the response
// deadline on each request and the review prompt on each finished shoot.
export function BookingsClient({
  initialBookings,
  initialTotalPages,
  initialCounts,
}: {
  initialBookings: BookingRow[];
  initialTotalPages: number;
  initialCounts: BookingTabCounts;
}) {
  const t = useTranslations("dashboardCore.bookings");
  const messaging = useMessaging();
  // Read once per mount: calling Date.now() during render is impure (the
  // React Compiler refuses it), and a list that is minutes stale about
  // whether yesterday is over is fine.
  const [now] = useState(() => Date.now());
  const { isCustomerOnly } = useUserRoles();

  function partyName(party: BookingParty) {
    return party.firstName ?? party.name ?? t("unknownParty");
  }
  const [tab, setTab] = useState<BookingTab>("ALL");
  const [page, setPage] = useState(1);
  const [bookings, setBookings] = useState<BookingRow[]>(initialBookings);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [counts, setCounts] = useState<BookingTabCounts>(initialCounts);
  const [isLoading, setIsLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [openingChatId, setOpeningChatId] = useState<string | null>(null);
  // The "ALL" tab's first page already arrived via SSR (see page.tsx) —
  // skip the redundant client refetch on mount.
  const isFirstRender = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings?status=${tab}&page=${page}`);
      if (!res.ok) throw new Error("load_failed");
      const body = await res.json();
      setBookings(body.data ?? []);
      setTotalPages(body.totalPages ?? 1);
      if (body.counts) setCounts(body.counts);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [tab, page]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    startTransition(() => {
      load();
    });
  }, [load]);

  const changeTab = (value: BookingTab) => {
    setIsLoading(true);
    setTab(value);
    setPage(1);
  };

  const changePage = (next: number) => {
    setIsLoading(true);
    setPage(next);
  };

  const updateStatus = async (
    id: string,
    status: "CONFIRMED" | "DECLINED" | "CANCELLED" | "COMPLETED",
  ) => {
    setActionId(id);
    await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setActionId(null);
    setIsLoading(true);
    load();
  };

  const openChat = async (bookingId: string, userId: string) => {
    setOpeningChatId(bookingId);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const body = await res.json();
      if (res.ok && body.data?.id) messaging.open(body.data.id);
    } finally {
      setOpeningChatId(null);
    }
  };

  const summary = [
    counts.PENDING > 0 ? t("summary.pending", { count: counts.PENDING }) : null,
    counts.upcoming > 0
      ? t("summary.upcoming", { count: counts.upcoming })
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-display-md text-text-primary">
            {isCustomerOnly ? t("titleCustomer") : t("titleProvider")}
          </h1>
          {summary ? (
            <p className="text-body-sm text-text-secondary">{summary}</p>
          ) : null}
        </div>
        {isCustomerOnly ? (
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/browse" />}
          >
            {t("findArtists")}
          </Button>
        ) : null}
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => changeTab(value as BookingTab)}
      >
        <TabsList>
          {TAB_VALUES.map((value) => (
            <TabsTab key={value} value={value}>
              {t(`tabs.${value.toLowerCase()}`)}
              {value !== "ALL" && counts[value] > 0 ? (
                <span className="ml-1 font-mono text-meta tabular-nums text-text-tertiary">
                  {counts[value]}
                </span>
              ) : null}
            </TabsTab>
          ))}
        </TabsList>
        {TAB_VALUES.map((value) => (
          <TabsPanel key={value} value={value} />
        ))}
      </Tabs>

      {isLoading ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 rounded-[var(--fg-radius-lg)]" />
          ))}
        </div>
      ) : loadFailed ? (
        <ErrorState
          title={t("error.title")}
          description={t("error.body")}
          kept={t("error.kept")}
          primaryAction={
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setIsLoading(true);
                load();
              }}
            >
              {t("error.retry")}
            </Button>
          }
        />
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={<Calendar />}
          title={t(tab === "ALL" ? "empty.heading" : "empty.headingTab")}
          description={
            isCustomerOnly ? t("empty.bodyCustomer") : t("empty.body")
          }
          primaryAction={
            isCustomerOnly ? (
              <Button
                size="sm"
                nativeButton={false}
                render={<Link href="/browse" />}
              >
                {t("findArtists")}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<Link href="/dashboard/settings/profile" />}
              >
                {t("shareProfile")}
              </Button>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {bookings.map((booking) => {
            const party = isCustomerOnly ? booking.provider : booking.customer;
            const isBusy = actionId === booking.id;
            // A confirmed shoot whose day is over stays "Confirmed" until the
            // provider says otherwise. Completing it is what lets the
            // customer leave a review.
            const isOverdue =
              !isCustomerOnly &&
              booking.status === "CONFIRMED" &&
              new Date(booking.date).getTime() + DAY_MS < now;
            const isFuture = new Date(booking.date).getTime() + DAY_MS > now;
            const canMessage = !["DECLINED", "EXPIRED"].includes(
              booking.status,
            );

            const messageButton = canMessage ? (
              <Button
                size="sm"
                variant="outline"
                disabled={openingChatId === booking.id}
                onClick={() => openChat(booking.id, party.id)}
              >
                {openingChatId === booking.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MessageCircle className="size-4" />
                )}
                {t("card.message")}
              </Button>
            ) : null;

            const actions = isCustomerOnly ? (
              <>
                {messageButton}
                <Button
                  size="sm"
                  variant="ghost"
                  nativeButton={false}
                  render={<Link href={`/dashboard/bookings/${booking.id}`} />}
                >
                  {t("viewDetails")}
                </Button>
                {(booking.status === "PENDING" ||
                  booking.status === "CONFIRMED") &&
                isFuture ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-text-secondary"
                    disabled={isBusy}
                    onClick={() => updateStatus(booking.id, "CANCELLED")}
                  >
                    {booking.status === "PENDING"
                      ? t("card.cancelRequest")
                      : t("cancel")}
                  </Button>
                ) : null}
              </>
            ) : (
              <>
                {booking.status === "PENDING" ? (
                  <>
                    <Button
                      size="sm"
                      variant="accent"
                      disabled={isBusy}
                      onClick={() => updateStatus(booking.id, "CONFIRMED")}
                    >
                      {t("accept")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isBusy}
                      onClick={() => updateStatus(booking.id, "DECLINED")}
                    >
                      {t("decline")}
                    </Button>
                  </>
                ) : null}
                {isOverdue ? (
                  <Button
                    size="sm"
                    variant="accent"
                    disabled={isBusy}
                    onClick={() => updateStatus(booking.id, "COMPLETED")}
                  >
                    {t("completeShort")}
                  </Button>
                ) : null}
                {messageButton}
                <div className="flex gap-2 sm:justify-between">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="sm:flex-1"
                    nativeButton={false}
                    render={<Link href={`/dashboard/bookings/${booking.id}`} />}
                  >
                    {t("details")}
                  </Button>
                  {booking.status === "CONFIRMED" ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={t("moreActions")}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => updateStatus(booking.id, "COMPLETED")}
                        >
                          {t("markComplete")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => updateStatus(booking.id, "CANCELLED")}
                        >
                          {t("cancel")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
              </>
            );

            return (
              <BookingListItem
                key={booking.id}
                now={now}
                asProvider={!isCustomerOnly}
                overdue={isOverdue}
                booking={{
                  id: booking.id,
                  status: booking.status,
                  date: booking.date,
                  startTime: booking.startTime,
                  endTime: booking.endTime,
                  totalPrice: booking.totalPrice,
                  currency: booking.currency,
                  locationType: booking.locationType,
                  locationAddress: booking.locationAddress,
                  expiresAt: booking.expiresAt,
                  serviceName: booking.service?.name ?? null,
                  party: { name: partyName(party), avatar: party.avatar },
                  reviewed: Boolean(booking.review),
                }}
                actions={actions}
              />
            );
          })}
        </div>
      )}

      {totalPages > 1 && !loadFailed ? (
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => changePage(page - 1)}
          >
            {t("previous")}
          </Button>
          <span className="text-body-sm text-text-secondary">
            {t("pageOf", { page, total: totalPages })}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => changePage(page + 1)}
          >
            {t("next")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
