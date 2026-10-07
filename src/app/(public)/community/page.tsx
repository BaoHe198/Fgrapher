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

// Cộng đồng F on Phòng tối (wave 2): the whole page is a place to look at
// work, so it sits on the darkroom surface; the F Booking call sheets in it
// stay ivory paper. Guests can read everything; acting asks for an account.
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
            className="font-mono text-meta tracking-[0.12em] text-dr-text-3 uppercase"
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
                  <span className="relative block size-14 shrink-0 overflow-hidden bg-dr-surface">
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
                    <span className="truncate text-body-sm font-semibold text-dr-text group-hover:underline">
                      {album.title}
                    </span>
                    <span className="truncate text-meta text-dr-text-2">
                      {album.artist}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          <p className="text-meta text-dr-text-3">{t("rail.featuredNote")}</p>
        </section>
      ) : null}
      {requests.length > 0 ? (
        <section aria-labelledby="cm-requests" className="flex flex-col gap-3">
          <h2
            id="cm-requests"
            className="font-mono text-meta tracking-[0.12em] text-dr-text-3 uppercase"
          >
            {t("rail.requests")}
          </h2>
          <ul className="flex flex-col divide-y divide-dr-line">
            {requests.map((request) => (
              <li key={request.id} className="flex flex-col gap-0.5 py-2.5">
                <span className="text-body-sm font-semibold text-dr-text">
                  {[
                    tService(request.role as "PHOTOGRAPHER"),
                    request.category ? categoryT(request.category) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span className="text-meta text-dr-text-2">
                  {request.province} ·{" "}
                  {formatBudgetRange(request.budgetMin, request.budgetMax) ??
                    t("rail.askPrice")}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/requests"
            className="focus-ring w-fit rounded-[4px] text-body-sm font-semibold text-gold-400"
          >
            {t("rail.allRequests")}
          </Link>
        </section>
      ) : null}
    </>
  );

  return (
    <div
      data-surface="darkroom"
      data-under-header=""
      className="min-h-screen bg-dr-bg text-dr-text"
    >
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 sm:py-10">
        <header className="mb-8 flex flex-col gap-3">
          <span className="font-mono text-meta tracking-[0.12em] text-dr-text-3 uppercase">
            {t("eyebrow")}
          </span>
          <h1 className="font-display text-[clamp(2.25rem,5vw,4rem)] leading-[0.98] font-semibold tracking-[-0.03em]">
            {t("heading")}
          </h1>
          <p className="max-w-2xl text-body-md text-dr-text-2">
            {t("subtitle")}
          </p>
        </header>
        <CommunityFeed viewerId={session?.user?.id ?? null} rail={rail} />
      </div>
    </div>
  );
}
