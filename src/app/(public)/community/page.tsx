import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { features } from "@/lib/features";

import { CommunityFeed } from "./community-feed";

export async function generateMetadata() {
  const t = await getTranslations("publicPages.community");
  return { title: `${t("heading")} — Fgrapher` };
}

export default async function CommunityPage() {
  // Dormant while SOCIAL_FEED_ENABLED=false — see CLAUDE.md.
  if (!features.socialFeedEnabled) notFound();

  const t = await getTranslations("publicPages.community");
  const session = await auth();

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-8 sm:py-8">
      <div className="relative mb-6 overflow-hidden rounded-[var(--fg-radius-xl)] border border-border-subtle bg-brand-primary px-5 py-6 text-text-on-brand sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -top-20 -right-16 size-56 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="relative max-w-2xl">
          <p className="mb-2 text-body-sm font-semibold! tracking-wide text-gold-300 uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="text-display-md">{t("heading")}</h1>
          <p className="mt-2 text-body-md text-white/75">{t("subtitle")}</p>
        </div>
      </div>
      <CommunityFeed viewerId={session?.user?.id ?? null} />
    </div>
  );
}
