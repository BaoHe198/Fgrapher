"use client";

import type { Booking, BookingStatus, User } from "@prisma/client";
import { Calendar, Loader2, MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { startTransition, useCallback, useEffect, useState } from "react";

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
import { formatCurrency } from "@/lib/utils";
import type { BookingTab } from "@/services/bookings";

type BookingParty = Pick<User, "id" | "name" | "firstName" | "avatar">;
type BookingRow = Booking & {
  customer: BookingParty;
  provider: BookingParty;
  service: { name: string } | null;
};

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

export default function BookingsPage() {
  const t = useTranslations("dashboardCore.bookings");
  const { isCustomerOnly } = useUserRoles();

  function partyName(party: BookingParty) {
    return party.firstName ?? party.name ?? t("unknownParty");
  }
  const [tab, setTab] = useState<BookingTab>("ALL");
  const [page, setPage] = useState(1);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/bookings?status=${tab}&page=${page}`);
    const body = await res.json();
    setBookings(body.data ?? []);
    setTotalPages(body.totalPages ?? 1);
    setIsLoading(false);
  }, [tab, page]);

  useEffect(() => {
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
          <p className="text-body-lg font-semibold text-text-primary">
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
          <div className="grid grid-cols-[1.2fr_1.2fr_1.4fr_0.8fr_0.9fr_auto] items-center border-b border-border-subtle px-5 py-3.5 text-caption-upper tracking-[0.06em] text-text-tertiary">
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

            return (
              <div
                key={booking.id}
                className="grid grid-cols-[1.2fr_1.2fr_1.4fr_0.8fr_0.9fr_auto] items-center border-b border-border-subtle px-5 py-4 text-body-md last:border-b-0"
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
                <span className="text-text-secondary">
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
                <Badge variant={statusVariant}>
                  {t(`status.${booking.status}`)}
                </Badge>

                <div className="flex justify-end gap-2">
                  {booking.status === "PENDING" && !isCustomerOnly ? (
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
                    </>
                  ) : null}

                  {booking.status === "CONFIRMED" && !isCustomerOnly ? (
                    <>
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
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button size="icon-sm" variant="ghost">
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
