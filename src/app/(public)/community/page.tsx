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
    <div className="mx-auto max-w-[720px] px-4 py-8 sm:px-8">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-display-md text-text-primary">{t("heading")}</h1>
        <p className="text-body-md text-text-secondary">{t("subtitle")}</p>
      </div>
      <CommunityFeed viewerId={session?.user?.id ?? null} />
    </div>
  );
}
