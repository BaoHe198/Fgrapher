"use client";

import type { Booking, BookingStatus, User } from "@prisma/client";
import { Calendar, Loader2, MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { useUserRoles } from "@/hooks/use-user-roles";
import { formatWeekdayDayMonth } from "@/lib/format";
import { cn, formatCurrency } from "@/lib/utils";
import type { BookingTab } from "@/services/bookings";

type BookingParty = Pick<User, "id" | "name" | "firstName" | "avatar">;
type BookingRow = Booking & {
  customer: BookingParty;
  provider: BookingParty;
  service: { name: string } | null;
};

// Header and every row share one template. The last column was `auto`, so
// each row sized it to its own buttons — a row with three actions and a row
// with none produced different widths for every other column, and nothing
// lined up with the header. Wide enough for the widest set: accept, decline,
// details.
//
// md and up only. On a phone six columns in ~340px crushed the headers into
// "KháchDịchThờiTổngTrạng", wrapped the date over five lines and pushed the
// action column out of the card entirely — a provider could not accept,
// decline or complete a booking from their phone. Below md each booking is
// a stacked card and the header row is hidden.
const ROW_GRID =
  "md:grid md:grid-cols-[1.2fr_1.2fr_1.4fr_0.8fr_0.9fr_16rem] md:items-center md:gap-0";

const DAY_MS = 24 * 60 * 60 * 1000;

const TAB_VALUES: BookingTab[] = [
  "ALL",
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
];

const STATUS_VARIANT: Record<
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

function formatWhen(date: string | Date, startTime: string) {
  return `${formatWeekdayDayMonth(date)} · ${startTime}`;
}

export function BookingsClient({
  initialBookings,
  initialTotalPages,
}: {
  initialBookings: BookingRow[];
  initialTotalPages: number;
}) {
  const t = useTranslations("dashboardCore.bookings");
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
  const [isLoading, setIsLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  // The "ALL" tab's first page already arrived via SSR (see page.tsx) —
  // skip the redundant client refetch on mount.
  const isFirstRender = useRef(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/bookings?status=${tab}&page=${page}`);
    const body = await res.json();
    setBookings(body.data ?? []);
    setTotalPages(body.totalPages ?? 1);
    setIsLoading(false);
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

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-display-md text-text-primary">
        {isCustomerOnly ? t("titleCustomer") : t("titleProvider")}
      </h1>

      <Tabs
        value={tab}
        onValueChange={(value) => changeTab(value as BookingTab)}
      >
        <TabsList>
          {TAB_VALUES.map((value) => (
            <TabsTab key={value} value={value}>
              {t(`tabs.${value.toLowerCase()}`)}
            </TabsTab>
          ))}
        </TabsList>
        {TAB_VALUES.map((value) => (
          <TabsPanel key={value} value={value} />
        ))}
      </Tabs>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-text-tertiary" />
        </div>
      ) : bookings.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <Calendar className="size-12 text-text-tertiary" />
          <p className="text-body-lg font-semibold! text-text-primary">
            {t("empty.heading")}
          </p>
          <p className="text-body-md text-text-secondary">{t("empty.body")}</p>
          {!isCustomerOnly ? (
            <Button
              variant="secondary"
              size="sm"
              nativeButton={false}
              render={<Link href="/dashboard/settings/profile" />}
            >
              {t("shareProfile")}
            </Button>
          ) : null}
        </Card>
      ) : (
        <Card padding={false}>
          <div
            className={cn(
              ROW_GRID,
              "hidden border-b border-border-subtle px-5 py-3.5 text-caption-upper tracking-[0.06em] text-text-tertiary",
            )}
          >
            <span>
              {isCustomerOnly ? t("table.provider") : t("table.client")}
            </span>
            <span>{t("table.service")}</span>
            <span>{t("table.when")}</span>
            <span>{t("table.total")}</span>
            <span>{t("table.status")}</span>
            <span />
          </div>

          {bookings.map((booking) => {
            const party = isCustomerOnly ? booking.provider : booking.customer;
            const statusVariant = STATUS_VARIANT[booking.status];
            const isBusy = actionId === booking.id;
            // A confirmed shoot whose day is over stays "Confirmed" until the
            // provider says otherwise — and the only way to say so was a "…"
            // menu. Seen in seed data: one sat confirmed for nearly a month.
            // Completing it is what lets the customer leave a review.
            const isOverdue =
              !isCustomerOnly &&
              booking.status === "CONFIRMED" &&
              new Date(booking.date).getTime() + DAY_MS < now;

            return (
              <div
                key={booking.id}
                className={cn(
                  ROW_GRID,
                  "flex flex-col gap-2 border-b border-border-subtle px-5 py-4 text-body-md last:border-b-0",
                )}
              >
                <div className="flex items-center gap-2">
                  <Avatar className="size-7">
                    {party.avatar ? (
                      <AvatarImage src={party.avatar} alt="" />
                    ) : null}
                    <AvatarFallback>
                      {partyName(party)[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-semibold text-text-primary">
                    {partyName(party)}
                  </span>
                </div>
                <span
                  className={cn(
                    "text-text-secondary",
                    // In the stacked phone card an empty service is a lone
                    // "—" on its own line; the table still needs the cell.
                    !booking.service && "hidden md:inline",
                  )}
                >
                  {booking.service?.name ?? "—"}
                </span>
                <span className="text-text-secondary">
                  {formatWhen(booking.date, booking.startTime)}
                </span>
                <span className="font-semibold text-text-primary">
                  {booking.totalPrice
                    ? formatCurrency(booking.totalPrice, booking.currency)
                    : "—"}
                </span>
                <div className="flex flex-col items-start gap-1">
                  <Badge variant={statusVariant}>
                    {t(`status.${booking.status}`)}
                  </Badge>
                  {isOverdue ? (
                    <span className="text-body-sm text-warning">
                      {t("needsCompletion")}
                    </span>
                  ) : null}
                </div>

                <div className="mt-1 flex flex-wrap gap-2 md:mt-0 md:justify-end">
                  {/* Details on every row. Only pending and confirmed
                      bookings used to have a way in, so a provider could
                      not open a completed, cancelled or expired booking
                      from their own list — and the row, missing its
                      buttons, also knocked every column out of line. */}
                  {!isCustomerOnly ? (
                    <>
                      {booking.status === "PENDING" ? (
                        <>
                          <Button
                            size="sm"
                            variant="accent"
                            disabled={isBusy}
                            onClick={() =>
                              updateStatus(booking.id, "CONFIRMED")
                            }
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
                      <Button
                        size="sm"
                        variant="secondary"
                        nativeButton={false}
                        render={
                          <Link href={`/dashboard/bookings/${booking.id}`} />
                        }
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
                              onClick={() =>
                                updateStatus(booking.id, "COMPLETED")
                              }
                            >
                              {t("markComplete")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() =>
                                updateStatus(booking.id, "CANCELLED")
                              }
                            >
                              {t("cancel")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </>
                  ) : null}

                  {isCustomerOnly ? (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        nativeButton={false}
                        render={
                          <Link href={`/dashboard/bookings/${booking.id}`} />
                        }
                      >
                        {t("viewDetails")}
                      </Button>
                      {(booking.status === "PENDING" ||
                        booking.status === "CONFIRMED") &&
                      new Date(booking.date) > new Date() ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isBusy}
                          onClick={() => updateStatus(booking.id, "CANCELLED")}
                        >
                          {t("cancel")}
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="secondary"
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
            variant="secondary"
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
