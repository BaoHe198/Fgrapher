import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { FmapClient } from "./fmap-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("fmap");
  return { title: t("title"), description: t("subtitle") };
}

export default function FmapPage() {
  return <FmapClient />;
}
