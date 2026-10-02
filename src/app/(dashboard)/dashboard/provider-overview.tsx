import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import {
  isGoldenHourSlot,
  minutesToTime,
  sunTimes,
  timeToMinutes,
} from "@/lib/sun";
import { cn, formatCurrency } from "@/lib/utils";
import type { ProviderOverview as Overview } from "@/services/dashboard";

import { PendingRequests } from "./pending-requests";

// The visible day on the timeline, in minutes after midnight.
const DAY_FROM = 5 * 60;
const DAY_TO = 21 * 60;
const pct = (minutes: number) =>
  ((Math.min(DAY_TO, Math.max(DAY_FROM, minutes)) - DAY_FROM) /
    (DAY_TO - DAY_FROM)) *
  100;

function vietnamMinutesNow(now: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(now));
  return timeToMinutes(parts);
}

/** A 7-point sparkline as an SVG path, scaled to `max`. */
function spark(values: number[], max: number) {
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 300;
      const y = 40 - (max === 0 ? 0 : (v / max) * 34);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

// Dashboard v2 for providers (wave 2): today on a timeline with the golden
// hours shaded, the requests waiting on them, the profile as a film roll
// of eight jobs, and the week in numbers. Everything is the provider's own
// data; a section with nothing true to show says so plainly.
export async function ProviderOverview({
  overview,
  dateKey,
  now,
}: {
  overview: Overview;
  dateKey: string;
  now: number;
}) {
  const t = await getTranslations("dashboardCore.home.v2");
  const sun = overview.sunPoint
    ? sunTimes(dateKey, overview.sunPoint.latitude, overview.sunPoint.longitude)
    : null;
  const nowMinutes = vietnamMinutesNow(now);
  const goldenBands = sun
    ? [
        [sun.sunrise - 20, sun.sunrise + 20],
        [sun.sunset - 90, sun.sunset - 20],
      ]
    : [];
  const thisWeek = overview.requestsByDay.slice(7);
  const lastWeek = overview.requestsByDay.slice(0, 7);
  const thisTotal = thisWeek.reduce((a, b) => a + b, 0);
  const lastTotal = lastWeek.reduce((a, b) => a + b, 0);
  const sparkMax = Math.max(1, ...overview.requestsByDay);
  const developed = overview.roll.filter((frame) => frame.done).length;

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="db-today" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="db-today" className="text-heading-lg text-text-primary">
            {t("today.title")}
          </h2>
          {sun ? (
            <span className="text-body-sm text-text-secondary">
              {t("today.sun", {
                rise: minutesToTime(sun.sunrise),
                set: minutesToTime(sun.sunset),
                morning: `${minutesToTime(sun.sunrise - 20)}–${minutesToTime(sun.sunrise + 20)}`,
                evening: `${minutesToTime(sun.sunset - 90)}–${minutesToTime(sun.sunset - 20)}`,
              })}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-4 rounded-[var(--fg-radius-md)] border border-border-subtle bg-bg-surface p-4 sm:p-5">
          <div aria-hidden className="relative h-24">
            {goldenBands.map(([from, to]) => (
              <span
                key={from}
                className="absolute top-0 bottom-6 border-x border-dashed border-gold-400 bg-gold-50 dark:bg-gold-900/30"
                style={{
                  left: `${pct(from)}%`,
                  width: `${pct(to) - pct(from)}%`,
                }}
              />
            ))}
            {overview.today.map((shoot) => {
              const start = timeToMinutes(shoot.startTime);
              const end = shoot.endTime
                ? timeToMinutes(shoot.endTime)
                : start + 60;
              return (
                <span
                  key={shoot.id}
                  className="absolute top-3 flex min-w-14 flex-col overflow-hidden rounded-[var(--fg-radius-sm)] bg-brand-primary px-2 py-1 text-text-on-brand"
                  style={{
                    left: `${pct(start)}%`,
                    width: `${Math.max(4, pct(end) - pct(start))}%`,
                  }}
                >
                  <span className="truncate text-meta">{shoot.startTime}</span>
                  <span className="truncate text-meta">{shoot.service}</span>
                </span>
              );
            })}
            {nowMinutes >= DAY_FROM && nowMinutes <= DAY_TO ? (
              <span
                className="absolute top-0 bottom-6 w-px bg-danger"
                style={{ left: `${pct(nowMinutes)}%` }}
              >
                <span className="absolute -top-0.5 left-1 text-meta text-danger">
                  {minutesToTime(nowMinutes)}
                </span>
              </span>
            ) : null}
            <div className="absolute inset-x-0 bottom-0 flex justify-between text-meta text-text-tertiary">
              {Array.from({ length: 9 }, (_, i) => DAY_FROM / 60 + i * 2).map(
                (hour) => (
                  <span key={hour}>{String(hour).padStart(2, "0")}</span>
                ),
              )}
            </div>
          </div>
          {overview.today.length === 0 ? (
            <p className="text-body-sm text-text-secondary">
              {t("today.none")}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {overview.today.map((shoot) => (
                <li
                  key={shoot.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm"
                >
                  <Link
                    href={`/dashboard/bookings/${shoot.id}`}
                    className="focus-ring rounded-[4px] font-semibold tabular-nums text-text-primary hover:underline"
                  >
                    {shoot.startTime}
                    {shoot.endTime ? `–${shoot.endTime}` : ""}
                  </Link>
                  <span className="text-text-primary">
                    {[shoot.service, shoot.customer]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {shoot.place ? (
                    <span className="text-text-secondary">{shoot.place}</span>
                  ) : null}
                  {sun && isGoldenHourSlot(shoot.startTime, sun) ? (
                    <span className="rounded-full bg-gold-100 px-2 py-0.5 text-meta font-semibold text-gold-800">
                      {t("today.golden")}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="db-pending" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="db-pending"
            className="text-body-sm font-semibold text-text-secondary"
          >
            {t("pending.title")}
          </h2>
          {overview.pending.length > 0 ? (
            <span className="text-body-sm text-text-tertiary max-md:hidden">
              {t("pending.keys")}
            </span>
          ) : null}
        </div>
        <PendingRequests requests={overview.pending} now={now} />
      </section>

      <section aria-labelledby="db-roll" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="db-roll" className="text-heading-lg text-text-primary">
            {t("roll.title")}
          </h2>
          <span className="text-body-sm text-text-primary">
            {t("roll.count", { done: developed, total: overview.roll.length })}
          </span>
        </div>
        <p className="text-body-sm text-text-secondary">{t("roll.lede")}</p>
        {/* A plain checklist (Core MVP pass, 02/10/2026): the film-roll
            treatment belongs to the portfolio, not the dashboard. */}
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {overview.roll.map((frame) => (
            <li key={frame.key}>
              <Link
                href={frame.href}
                className="focus-ring group flex min-h-14 items-center gap-3 rounded-[var(--fg-radius-md)] border border-border-subtle bg-bg-surface px-4 py-3 hover:border-border-strong"
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full border",
                    frame.done
                      ? "border-success bg-success text-text-on-brand"
                      : "border-dashed border-border-strong",
                  )}
                >
                  {frame.done ? <Check className="size-3.5" /> : null}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 text-body-sm group-hover:underline",
                    frame.done
                      ? "text-text-secondary"
                      : "font-semibold text-text-primary",
                  )}
                >
                  {t(`roll.items.${frame.key}`)}
                  <span className="sr-only">
                    {" · "}
                    {frame.done ? t("roll.done") : t("roll.undeveloped")}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="db-week" className="flex flex-col gap-3">
        <h2 id="db-week" className="text-heading-lg text-text-primary">
          {t("week.title")}
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex flex-col gap-2 rounded-[var(--fg-radius-md)] border border-border-subtle bg-bg-surface p-5">
            <span className="text-body-sm font-semibold text-text-secondary">
              {t("week.requests")}
            </span>
            <span className="flex items-baseline gap-3">
              <span className="font-display text-display-sm font-semibold tabular-nums text-text-primary">
                {thisTotal}
              </span>
              <span className="text-body-sm text-text-secondary">
                {t("week.lastWeek", { count: lastTotal })}
              </span>
            </span>
            <svg
              viewBox="0 0 300 42"
              aria-hidden
              className="h-10 w-full overflow-visible"
              preserveAspectRatio="none"
            >
              <path
                d={spark(lastWeek, sparkMax)}
                fill="none"
                stroke="var(--border-strong)"
                strokeDasharray="4 4"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={spark(thisWeek, sparkMax)}
                fill="none"
                stroke="var(--brand-primary)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <span className="text-meta text-text-tertiary">
              {t("week.legend")}
            </span>
          </div>
          <div className="flex flex-col gap-2 rounded-[var(--fg-radius-md)] border border-border-subtle bg-bg-surface p-5">
            <span className="text-body-sm font-semibold text-text-secondary">
              {t("week.views")}
            </span>
            <span className="font-display text-display-sm font-semibold tabular-nums text-text-primary">
              {overview.views}
            </span>
            <span className="text-meta text-text-tertiary">
              {t("week.viewsNote")}
            </span>
          </div>
          <div className="flex flex-col gap-2 rounded-[var(--fg-radius-md)] border border-border-subtle bg-bg-surface p-5">
            <span className="text-body-sm font-semibold text-text-secondary">
              {t("week.completed")}
            </span>
            <span className="flex items-baseline gap-3">
              <span className="font-display text-display-sm font-semibold tabular-nums text-text-primary">
                {overview.completedThisMonth.count}
              </span>
              <span className="text-body-sm text-text-secondary">
                {t("week.value", {
                  value: formatCurrency(overview.completedThisMonth.value),
                })}
              </span>
            </span>
            <span className="text-meta text-text-tertiary">
              {t("week.completedNote")}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
