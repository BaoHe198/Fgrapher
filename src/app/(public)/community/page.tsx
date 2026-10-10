import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { features } from "@/lib/features";
import { buildMediaVariants } from "@/lib/media/variants";
import { formatBudgetRange } from "@/lib/utils";
import { listFeaturedAlbums } from "@/services/posts";
import { listRecentRequestTeasers } from "@/services/service-requests";

import { CommunityFeed } from "./community-feed";

export async function generateMetadata() {
  const t = await getTranslations("publicPages.community");
  return { title: `${t("heading")} — Fgrapher` };
}

// Cộng đồng F: shared albums and F Booking call sheets, on the same light
// surface as the rest of the site (the owner dropped the darkroom page,
// 07/10/2026). Guests can read everything; acting asks for an account.
export default async function CommunityPage() {
  // Dormant while SOCIAL_FEED_ENABLED=false — see CLAUDE.md.
  if (!features.socialFeedEnabled) notFound();

  const t = await getTranslations("publicPages.community");
  const tService = await getTranslations("publicPages.requestsF.service");
  const categoryT = await getTranslations("profileCategory");
  const session = await auth();
  const [featured, requests] = await Promise.all([
    listFeaturedAlbums(4),
    listRecentRequestTeasers(3),
  ]);

  const rail = (
    <>
      {featured.length > 0 ? (
        <section aria-labelledby="cm-featured" className="flex flex-col gap-3">
          <h2
            id="cm-featured"
            className="font-mono text-meta tracking-[0.12em] text-text-tertiary uppercase"
          >
            {t("rail.featured")}
          </h2>
          <ol className="flex flex-col gap-3">
            {featured.map((album) => (
              <li key={album.albumId}>
                <Link
                  href={`/profile/${album.username}/albums/${album.albumId}`}
                  className="focus-ring group flex items-center gap-3 rounded-[var(--fg-radius-sm)]"
                >
                  <span className="relative block size-14 shrink-0 overflow-hidden bg-bg-sunken">
                    {album.cover ? (
                      <Image
                        src={buildMediaVariants(album.cover).thumbnail}
                        alt=""
                        fill
                        unoptimized
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : null}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-body-sm font-semibold text-text-primary group-hover:underline">
                      {album.title}
                    </span>
                    <span className="truncate text-meta text-text-secondary">
                      {album.artist}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          <p className="text-meta text-text-tertiary">
            {t("rail.featuredNote")}
          </p>
        </section>
      ) : null}
      {requests.length > 0 ? (
        <section aria-labelledby="cm-requests" className="flex flex-col gap-3">
          <h2
            id="cm-requests"
            className="font-mono text-meta tracking-[0.12em] text-text-tertiary uppercase"
          >
            {t("rail.requests")}
          </h2>
          <ul className="flex flex-col divide-y divide-border-subtle">
            {requests.map((request) => (
              <li key={request.id} className="flex flex-col gap-0.5 py-2.5">
                <span className="text-body-sm font-semibold text-text-primary">
                  {[
                    tService(request.role as "PHOTOGRAPHER"),
                    request.category ? categoryT(request.category) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span className="text-meta text-text-secondary">
                  {request.province} ·{" "}
                  {formatBudgetRange(request.budgetMin, request.budgetMax) ??
                    t("rail.askPrice")}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/requests"
            className="focus-ring w-fit rounded-[4px] text-body-sm font-semibold text-gold-600 dark:text-gold-400"
          >
            {t("rail.allRequests")}
          </Link>
        </section>
      ) : null}
    </>
  );

  return (
    <div className="min-h-screen bg-bg-page text-text-primary">
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 sm:py-10">
        {/* No intro block (owner, 10/10/2026): the feed explains itself. */}
        <h1 className="sr-only">{t("heading")}</h1>
        <CommunityFeed viewerId={session?.user?.id ?? null} rail={rail} />
      </div>
    </div>
  );
}
