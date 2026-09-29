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
        <span className="inline-block max-w-[260px] rounded-[var(--fg-radius-md)] rounded-bl-[4px] bg-surface-card px-3 py-2 text-body-sm text-text-primary shadow-[var(--shadow-sm)]">
          {t("chatSample")}
        </span>
      ),
      title: t("chatTitle"),
      desc: t("chatDesc"),
    },
  ];

  return (
    <section className="mx-auto max-w-[1440px] px-8 pt-20 max-md:hidden">
      <div className="border-t border-border-subtle pt-12">
        <RiseOnView>
          <h2 className="mb-6 text-display-md text-text-primary">
            {t("title")}
          </h2>
        </RiseOnView>
        <ul className="grid grid-cols-3 gap-5 max-lg:grid-cols-1">
          {items.map((item) => (
            <li key={item.key} className="flex flex-col gap-3">
              <div className="flex min-h-24 items-center rounded-[var(--fg-radius-lg)] bg-bg-sunken p-4">
                {item.art}
              </div>
              <h3 className="text-heading-sm text-text-primary">
                {item.title}
              </h3>
              <p className="text-body-sm text-text-secondary">{item.desc}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-body-sm text-text-tertiary">{t("footnote")}</p>
      </div>
    </section>
  );
}
