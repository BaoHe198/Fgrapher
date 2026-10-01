import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";

import { frameLabel } from "@/lib/media/frame-label";
import { buildMediaVariants } from "@/lib/media/variants";
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
                  <span className="truncate font-mono text-meta">
                    {shoot.startTime}
                  </span>
                  <span className="truncate text-meta">{shoot.service}</span>
                </span>
              );
            })}
            {nowMinutes >= DAY_FROM && nowMinutes <= DAY_TO ? (
              <span
                className="absolute top-0 bottom-6 w-px bg-danger"
                style={{ left: `${pct(nowMinutes)}%` }}
              >
                <span className="absolute -top-0.5 left-1 font-mono text-meta text-danger">
                  {minutesToTime(nowMinutes)}
                </span>
              </span>
            ) : null}
            <div className="absolute inset-x-0 bottom-0 flex justify-between font-mono text-meta text-text-tertiary">
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
                    className="focus-ring rounded-[4px] font-mono font-semibold tabular-nums text-text-primary hover:underline"
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
            className="font-mono text-meta tracking-[0.12em] text-text-secondary uppercase"
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
          <span className="font-mono text-body-sm text-text-primary">
            {t("roll.count", { done: developed, total: overview.roll.length })}
          </span>
        </div>
        <p className="text-body-sm text-text-secondary">{t("roll.lede")}</p>
        <ol
          data-surface="darkroom"
          className="relative grid grid-cols-4 gap-1 overflow-hidden rounded-[var(--fg-radius-sm)] bg-dr-bg px-2 py-6 before:absolute before:inset-x-0 before:top-1.5 before:h-1.5 before:bg-[radial-gradient(closest-side,var(--dr-line-2)_96%,transparent)] before:bg-[length:14px_6px] before:bg-repeat-x after:absolute after:inset-x-0 after:bottom-1.5 after:h-1.5 after:bg-[radial-gradient(closest-side,var(--dr-line-2)_96%,transparent)] after:bg-[length:14px_6px] after:bg-repeat-x lg:grid-cols-8"
        >
          {overview.roll.map((frame, index) => {
            // Developed frames show the artist's photos in turn; a frame
            // done before there are enough photos stays a plain exposure.
            const doneIndex = overview.roll
              .slice(0, index)
              .filter((f) => f.done).length;
            const photo = overview.rollPhotos[doneIndex];
            return (
              <li key={frame.key}>
                <Link
                  href={frame.href}
                  className="focus-ring group flex h-full flex-col gap-1.5"
                >
                  <span className="relative block aspect-[4/3] overflow-hidden bg-dr-surface">
                    {frame.done && !photo ? (
                      <span className="absolute inset-0 bg-dr-raised" />
                    ) : null}
                    {frame.done && photo ? (
                      <Image
                        src={buildMediaVariants(photo).thumbnail}
                        alt=""
                        fill
                        unoptimized
                        sizes="160px"
                        className="object-cover"
                      />
                    ) : null}
                    {!frame.done ? (
                      <span className="absolute inset-0 grid place-items-center bg-[repeating-linear-gradient(135deg,var(--dr-raised)_0_6px,var(--dr-surface)_6px_12px)] font-mono text-meta tracking-[0.12em] text-gold-400 uppercase">
                        {t("roll.undeveloped")}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex items-center gap-1.5 font-mono text-meta text-gold-400">
                    {frameLabel(index * 6)}
                    {frame.done ? (
                      <Check aria-label={t("roll.done")} className="size-3.5" />
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      "text-body-sm text-dr-text group-hover:underline",
                      !frame.done && "font-semibold",
                    )}
                  >
                    {t(`roll.items.${frame.key}`)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="db-week" className="flex flex-col gap-3">
        <h2 id="db-week" className="text-heading-lg text-text-primary">
          {t("week.title")}
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex flex-col gap-2 rounded-[var(--fg-radius-md)] border border-border-subtle bg-bg-surface p-5">
            <span className="font-mono text-meta tracking-[0.12em] text-text-secondary uppercase">
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
            <span className="font-mono text-meta tracking-[0.12em] text-text-secondary uppercase">
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
            <span className="font-mono text-meta tracking-[0.12em] text-text-secondary uppercase">
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
