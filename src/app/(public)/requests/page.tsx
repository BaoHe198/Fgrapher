import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { CallSheet } from "@/components/requests/call-sheet";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { frameLabel } from "@/lib/media/frame-label";
import { formatBudgetRange } from "@/lib/utils";
import { listProvinces } from "@/services/geography";
import {
  listRecentRequestTeasers,
  REQUEST_TTL_DAYS,
} from "@/services/service-requests";

import { BrowseRequestsClient } from "./browse-requests-client";
import { PostRequestButton } from "./post-request-button";

// The example call sheet is dated a month from today and placed in the
// first province of the registry: plainly an example ("VÍ DỤ" stamp), not
// a record of a real request.
function exampleShootDate() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 30);
  return date;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("publicPages.requestsF");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/requests" },
  };
}

// Đặt lịch F (wave 2). Readable without an account: what a request is, an
// example call sheet and the three steps. Signed out, the latest requests
// show only service, style, province and budget; signed in, the full list
// of open requests (what providers come here for) takes that place.
export default async function RequestsPage() {
  const t = await getTranslations("publicPages.requestsF");
  const tService = await getTranslations("publicPages.requestsF.service");
  const tCategory = await getTranslations("profileCategory");
  const tBrowse = await getTranslations("dashboardCore.browseRequests");
  const session = await auth();
  const isAuthenticated = Boolean(session?.user);

  const [provinces, teasers] = await Promise.all([
    listProvinces(),
    isAuthenticated ? Promise.resolve([]) : listRecentRequestTeasers(6),
  ]);

  const exampleDate = exampleShootDate();
  const example = {
    need: t("example.need"),
    when: `${formatDate(exampleDate)}\n${t("example.flex")}`,
    where: provinces[0]?.name ?? "",
    style: t("example.style"),
    budget: formatBudgetRange(5_000_000, 10_000_000) ?? "",
    note: t("example.note"),
  };

  return (
    <div className="bg-bg-page">
      <section
        aria-labelledby="rq-title"
        className="mx-auto grid max-w-[1440px] items-center gap-10 px-5 pt-[clamp(40px,6vw,88px)] pb-[clamp(40px,5vw,72px)] sm:px-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16"
      >
        <div className="flex flex-col gap-6">
          <span className="font-mono text-meta tracking-[0.12em] text-text-tertiary uppercase">
            {t("eyebrow")}
          </span>
          <h1
            id="rq-title"
            className="font-display text-[clamp(2.5rem,5.4vw,5rem)] leading-[0.98] font-semibold tracking-[-0.03em] text-balance text-text-primary"
          >
            {t("title")}
          </h1>
          <p className="max-w-xl text-body-lg text-text-secondary">
            {t("lede")}
          </p>
          <div className="flex flex-wrap gap-3">
            <PostRequestButton isAuthenticated={isAuthenticated} />
            <Button
              variant="ghost"
              size="lg"
              nativeButton={false}
              render={<Link href="/browse" />}
            >
              {t("findDirect")}
            </Button>
          </div>
          <span className="text-body-sm text-text-tertiary">
            {isAuthenticated ? t("noteSignedIn") : t("noteSignedOut")}
          </span>
        </div>
        <CallSheet
          code="YC-2026-00012"
          stamp={t("example.stamp")}
          data={example}
          className="lg:rotate-[0.6deg]"
        />
      </section>

      <section
        aria-labelledby="rq-steps"
        className="border-y border-border-subtle bg-bg-surface"
      >
        <div className="mx-auto flex max-w-[1440px] flex-col gap-8 px-5 py-[clamp(40px,5vw,72px)] sm:px-8">
          <h2 id="rq-steps" className="text-heading-lg text-text-primary">
            {t("steps.title")}
          </h2>
          <ol className="grid gap-8 md:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <li
                key={n}
                className="flex flex-col gap-2 border-t border-border-default pt-4"
              >
                <span className="font-mono text-meta tracking-[0.12em] text-gold-700 uppercase dark:text-gold-400">
                  {frameLabel(n - 1)} · {t(`steps.s${n}tag`)}
                </span>
                <strong className="text-heading-sm text-text-primary">
                  {t(`steps.s${n}t`)}
                </strong>
                <span className="text-body-md text-text-secondary">
                  {t(`steps.s${n}b`, { days: REQUEST_TTL_DAYS })}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {isAuthenticated ? (
        <BrowseRequestsClient
          heading={tBrowse("heading")}
          subheading={tBrowse("subheading")}
          provinces={provinces.map((p) => ({
            id: p.id,
            code: p.code,
            name: p.name,
          }))}
        />
      ) : teasers.length > 0 ? (
        <section
          aria-labelledby="rq-recent"
          className="mx-auto flex max-w-[1440px] flex-col gap-6 px-5 pt-[clamp(40px,5vw,72px)] sm:px-8"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="rq-recent" className="text-heading-lg text-text-primary">
              {t("recent.title")}
            </h2>
            <span className="font-mono text-meta tracking-[0.12em] text-text-tertiary uppercase">
              {t("recent.privacy")}
            </span>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teasers.map((teaser, index) => (
              <li
                key={teaser.id}
                className="flex flex-col gap-2 rounded-[var(--fg-radius-md)] border border-border-subtle bg-bg-surface p-4"
              >
                <span className="font-mono text-meta tracking-[0.12em] text-text-tertiary">
                  {frameLabel(index)}
                </span>
                <strong className="text-body-lg font-semibold! text-text-primary">
                  {[
                    tService(teaser.role as "PHOTOGRAPHER"),
                    teaser.category ? tCategory(teaser.category) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </strong>
                <span className="flex flex-wrap justify-between gap-x-3 text-body-sm text-text-secondary">
                  <span>{teaser.province}</span>
                  <span className="font-semibold! text-text-primary">
                    {formatBudgetRange(teaser.budgetMin, teaser.budgetMax) ??
                      t("recent.askPrice")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {isAuthenticated ? null : (
        <section className="mx-auto max-w-[1440px] px-5 py-[clamp(40px,5vw,72px)] sm:px-8">
          <div className="flex flex-col gap-4 rounded-[var(--fg-radius-lg)] bg-bg-sunken p-6 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex flex-col gap-1">
              <strong className="text-body-lg font-semibold! text-text-primary">
                {t("trust.title")}
              </strong>
              <span className="text-body-sm text-text-secondary">
                {t("trust.body")}
              </span>
            </span>
            <PostRequestButton isAuthenticated={false} />
          </div>
        </section>
      )}
    </div>
  );
}
