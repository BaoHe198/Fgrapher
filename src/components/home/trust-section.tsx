import { BadgeCheck, Star } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { RiseOnView } from "@/components/ui/rise-on-view";
import { formatDate } from "@/lib/format";
import type { HomeReviewQuote } from "@/services/home";

// "Đặt lịch yên tâm" - three promises, each shown as the thing itself
// rather than an icon: the verified badge, a real review, a chat bubble.
// The footnote states the booking terms plainly: a request, 48 hours to
// confirm, deposit agreed directly, no online payment (CLAUDE.md MVP scope).
export async function TrustSection({
  review,
}: {
  review: HomeReviewQuote | null;
}) {
  const t = await getTranslations("home.trust");
  const items = [
    {
      key: "verified",
      art: (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-3 py-1 text-body-sm font-semibold! text-success">
          <BadgeCheck aria-hidden className="size-4" />
          {t("verifiedBadge")}
        </span>
      ),
      title: t("verifiedTitle"),
      desc: t("verifiedDesc"),
    },
    {
      key: "review",
      art: (
        <span className="flex flex-col gap-1">
          <span className="flex items-center gap-1 text-body-sm font-semibold! text-text-primary">
            <span className="flex text-gold-400" aria-hidden>
              {Array.from({ length: 5 }, (_, i) => (
                <Star
                  key={i}
                  className={
                    i < (review?.rating ?? 5)
                      ? "size-3.5 fill-current"
                      : "size-3.5"
                  }
                />
              ))}
            </span>
            {(review?.rating ?? 5).toFixed(1).replace(".", ",")}
          </span>
          {review ? (
            <span className="line-clamp-2 text-body-sm text-text-secondary">
              “{review.content}”
            </span>
          ) : null}
          <span className="text-meta text-text-tertiary">
            {review && review.reviewerName
              ? t("reviewMeta", {
                  name: review.reviewerName,
                  date: formatDate(review.createdAt),
                })
              : t("reviewFallback")}
          </span>
        </span>
      ),
      title: t("reviewTitle"),
      desc: t("reviewDesc"),
    },
    {
      key: "chat",
      art: (
        <span className="inline-block max-w-[260px] rounded-[var(--fg-radius-md)] rounded-bl-[4px] bg-bg-sunken px-3 py-2 text-body-sm text-text-primary">
          {t("chatSample")}
        </span>
      ),
      title: t("chatTitle"),
      desc: t("chatDesc"),
    },
  ];

  // A full-width dark band (owner, 16/11/2026): identity checks and real
  // reviews are the reason to trust a stranger with a wedding, so they get
  // the page's second-loudest block instead of three grey slots.
  return (
    <section className="mt-20 bg-green-900 text-gold-50 max-md:mt-12">
      <div className="mx-auto max-w-[1440px] px-8 py-16 max-md:px-5 max-md:py-10">
        <RiseOnView>
          <h2 className="mb-8 max-w-[18ch] text-display-lg text-gold-50 max-md:mb-6 max-md:text-display-md">
            {t("title")}
          </h2>
        </RiseOnView>
        <ul className="grid grid-cols-3 gap-5 max-lg:grid-cols-1">
          {items.map((item) => (
            <li
              key={item.key}
              className="flex flex-col gap-4 rounded-[var(--fg-radius-lg)] bg-green-800 p-5"
            >
              <div className="flex min-h-28 items-center rounded-[var(--fg-radius-md)] bg-bg-surface p-4">
                {item.art}
              </div>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-heading-md text-gold-50">{item.title}</h3>
                <p className="text-body-md text-green-200">{item.desc}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-8 max-w-3xl text-body-sm text-green-200">
          {t("footnote")}
        </p>
      </div>
    </section>
  );
}
