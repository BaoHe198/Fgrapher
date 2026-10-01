"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { cn, formatCurrency } from "@/lib/utils";

interface PendingRequest {
  id: string;
  customerId: string;
  customer: string;
  date: string;
  startTime: string;
  service: string | null;
  totalPrice: number | null;
  notes: string | null;
  expiresAt: string | null;
}

const WINDOW_HOURS = 48;
const VN_TIME = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const VN_DAY = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
});

// Requests waiting on the provider (wave 2 dashboard): each with the hours
// left of its 48-hour window and a bar that runs out with it, red in the
// last six hours. A/X/M accept, decline or message the selected one -
// only while focus is not in a field, and never with a modifier key.
export function PendingRequests({
  requests,
  now,
}: {
  requests: PendingRequest[];
  now: number;
}) {
  const t = useTranslations("dashboardCore.home.v2.pending");
  const router = useRouter();
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const visible = requests.filter((r) => !done.has(r.id));
  const selected = visible[Math.min(active, visible.length - 1)];
  const act = useRef<(key: string) => void>(() => {});

  const respond = async (id: string, status: "CONFIRMED" | "DECLINED") => {
    setBusy(id);
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(null);
    if (res.ok) {
      setDone((prev) => new Set(prev).add(id));
      router.refresh();
    }
  };

  const message = async (request: PendingRequest) => {
    setBusy(request.id);
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: request.customerId }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    router.push(
      body.data?.id
        ? `/dashboard/messages?c=${body.data.id}`
        : "/dashboard/messages",
    );
  };

  useEffect(() => {
    act.current = (key: string) => {
      if (!selected || busy) return;
      if (key === "a") void respond(selected.id, "CONFIRMED");
      else if (key === "x") void respond(selected.id, "DECLINED");
      else if (key === "m") void message(selected);
    };
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
        target.isContentEditable ||
        target.closest("[role=dialog]")
      )
        return;
      const key = e.key.toLowerCase();
      if (key === "a" || key === "x" || key === "m") act.current(key);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (visible.length === 0) {
    return (
      <p className="rounded-[var(--fg-radius-md)] border border-dashed border-border-default px-5 py-4 text-body-sm text-text-secondary">
        {t("empty")}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {visible.map((request, index) => {
        const hoursLeft = request.expiresAt
          ? Math.max(
              0,
              Math.ceil(
                (new Date(request.expiresAt).getTime() - now) / 3_600_000,
              ),
            )
          : null;
        const urgent = hoursLeft !== null && hoursLeft <= 6;
        const isSelected = request.id === selected?.id;
        return (
          <li
            key={request.id}
            onClick={() => setActive(index)}
            onFocus={() => setActive(index)}
            className={cn(
              "flex flex-col gap-4 rounded-[var(--fg-radius-md)] border bg-bg-surface p-4 lg:flex-row lg:items-center",
              isSelected
                ? "border-brand-primary shadow-[inset_0_0_0_1px_var(--brand-primary)]"
                : "border-border-subtle",
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <strong className="text-body-lg font-semibold text-text-primary">
                {request.service ?? t("custom")}
              </strong>
              <span className="text-body-sm text-text-secondary">
                {[
                  request.customer,
                  `${formatDate(request.date)} · ${request.startTime}`,
                  request.totalPrice
                    ? formatCurrency(request.totalPrice)
                    : t("quoteLater"),
                ].join(" · ")}
              </span>
              {request.notes ? (
                <span className="line-clamp-2 text-body-sm text-text-primary">
                  “{request.notes}”
                </span>
              ) : null}
            </div>
            {hoursLeft !== null && request.expiresAt ? (
              <div className="flex w-40 shrink-0 flex-col gap-1">
                <span
                  className={cn(
                    "font-mono text-body-md font-semibold tabular-nums",
                    urgent ? "text-danger" : "text-text-primary",
                  )}
                >
                  {t("hoursLeft", { hours: hoursLeft })}
                </span>
                <span className="text-meta text-text-tertiary">
                  {t("deadline", {
                    time: VN_TIME.format(new Date(request.expiresAt)),
                    date: VN_DAY.format(new Date(request.expiresAt)),
                  })}
                </span>
                <span className="h-1 overflow-hidden rounded-full bg-bg-sunken">
                  <span
                    className={cn(
                      "block h-full rounded-full",
                      urgent ? "bg-danger" : "bg-brand-primary",
                    )}
                    style={{
                      width: `${Math.min(100, (hoursLeft / WINDOW_HOURS) * 100)}%`,
                    }}
                  />
                </span>
              </div>
            ) : null}
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busy === request.id}
                onClick={() => respond(request.id, "CONFIRMED")}
                aria-keyshortcuts={isSelected ? "A" : undefined}
              >
                {t("accept")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy === request.id}
                onClick={() => respond(request.id, "DECLINED")}
                aria-keyshortcuts={isSelected ? "X" : undefined}
              >
                {t("decline")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy === request.id}
                onClick={() => message(request)}
                aria-keyshortcuts={isSelected ? "M" : undefined}
              >
                {t("message")}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
