import { Hourglass } from "lucide-react";
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
import type { MyPageCard, MyPageStatus } from "@/services/my-page";

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

// Which set-up card each publish blocker is fixed on.
const BLOCKER_CARD: Record<string, MyPageCard["key"]> = {
  verify: "verify",
  photo: "portfolio",
  costumePhoto: "costumes",
  categories: "info",
  address: "area",
};

// Dashboard v2 for providers (wave 2): today on a timeline with the golden
// hours shaded, the requests waiting on them, what is left to set up, and
// the week in numbers. Everything is the provider's own data; a section
// with nothing true to show says so plainly.
//
// Order (25/11/2026): what has a deadline or keeps customers away comes
// first. Requests waiting for an answer sat under an empty "Hôm nay" and
// had to be scrolled to; and a new account met two set-up lists, the upper
// one about working hours while the step actually holding the page back,
// identity verification, was in the lower one. There is one list now.
export async function ProviderOverview({
  overview,
  myPage,
  dateKey,
  now,
}: {
  overview: Overview;
  /** "Trang của tôi" status — the set-up list shown here. */
  myPage: MyPageStatus | null;
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
  const tPage = await getTranslations("dashboardCore.myPage");
  const pageCountable = (myPage?.cards ?? []).filter(
    (card) => card.state !== "info",
  );
  const pageDone = pageCountable.filter((card) => card.state === "done").length;
  const pageTotal = pageCountable.length;
  const pageOpenAll = pageCountable.filter((card) => card.state !== "done");

  // What keeps the page hidden (the publish blockers) or keeps customers
  // from finding and booking a page that is shown: no working hours, no
  // point on Bản đồ F. Said at the top (owner, 16/11/2026), and listed
  // first. The rest is polish and stays lower down.
  const required = new Set(
    myPage && !myPage.published
      ? myPage.blockers.map((blocker) => BLOCKER_CARD[blocker])
      : [],
  );
  const holdsBack = (card: MyPageCard) =>
    required.has(card.key) || card.key === "hours" || card.key === "area";
  const pageOpen = [
    ...pageOpenAll.filter(holdsBack),
    ...pageOpenAll.filter((card) => !holdsBack(card)),
  ];
  const setupFirst = pageOpenAll.some(holdsBack);
  const hasPending = overview.pending.length > 0;

  const pendingSection = (
    <section aria-labelledby="db-pending" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="db-pending"
          className={
            hasPending
              ? "text-heading-lg text-text-primary"
              : "text-body-sm font-semibold text-text-secondary"
          }
        >
          {t("pending.title")}
        </h2>
        {hasPending ? (
          <span className="text-body-sm text-text-tertiary max-md:hidden">
            {t("pending.keys")}
          </span>
        ) : null}
      </div>
      <PendingRequests requests={overview.pending} now={now} />
    </section>
  );

  // The page's set-up state, read from the same source as "Trang của tôi"
  // so the two always give the same count (they used to keep two different
  // lists: 6/8 here, 6/7 there). Only what is still to do is listed; the
  // hub has the full picture.
  const setupSection = myPage ? (
    <section
      aria-labelledby="db-roll"
      className={cn(
        "flex flex-col gap-3",
        setupFirst &&
          "rounded-[var(--fg-radius-md)] border border-gold-400 bg-gold-50 p-4 sm:p-5 dark:border-gold-700 dark:bg-gold-900/30",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="db-roll" className="text-heading-lg text-text-primary">
          {setupFirst
            ? myPage.published
              ? t("findability.title")
              : t("page.titleHidden")
            : t("page.title")}
        </h2>
        <span className="text-body-sm text-text-primary">
          {t("page.count", { done: pageDone, total: pageTotal })}
        </span>
      </div>
      {pageOpen.length === 0 ? (
        <p className="text-body-sm text-text-secondary">{t("page.allDone")}</p>
      ) : (
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {pageOpen.map((card) => (
            <li key={card.key}>
              <Link
                href={card.href}
                className="focus-ring group flex min-h-14 items-center gap-3 rounded-[var(--fg-radius-md)] border border-border-subtle bg-bg-surface px-4 py-3 hover:border-border-strong"
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full border",
                    card.state === "waiting"
                      ? "border-warning bg-warning-bg text-warning"
                      : "border-dashed border-border-strong",
                  )}
                >
                  {card.state === "waiting" ? (
                    <Hourglass className="size-3.5" />
                  ) : null}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex flex-wrap items-center gap-x-2 text-body-sm font-semibold text-text-primary">
                    <span className="group-hover:underline">
                      {tPage(`cards.${card.key}.title`)}
                    </span>
                    {required.has(card.key) ? (
                      <span className="rounded-full bg-gold-100 px-2 py-0.5 text-meta font-semibold text-gold-800">
                        {t("page.required")}
                      </span>
                    ) : null}
                    <span className="sr-only">
                      {" · "}
                      {tPage(`state.${card.state}`)}
                    </span>
                  </span>
                  <span className="text-meta text-text-tertiary">
                    {tPage(`cards.${card.key}.${card.detail}`, card.values)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
      <Link
        href="/dashboard/my-page"
        className="focus-ring -my-2 w-fit rounded-[4px] py-2 text-body-sm font-semibold! text-text-link hover:underline"
      >
        {t("page.open")}
      </Link>
    </section>
  ) : null;

  return (
    <div className="flex flex-col gap-10">
      {hasPending ? pendingSection : null}
      {setupFirst ? setupSection : null}

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

      {hasPending ? null : pendingSection}
      {setupFirst ? null : setupSection}

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
