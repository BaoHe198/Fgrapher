import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { VerifyEmailPanel } from "./verify-email-panel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("accountFlows.verifyEmail");
  return {
    title: t("metaTitle"),
    // A verification link must never be indexed or forwarded to a
    // referrer — the token is in the query string.
    robots: { index: false, follow: false },
  };
}

interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string; email?: string }>;
}

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const params = await searchParams;

  return (
    <VerifyEmailPanel
      token={params.token ?? null}
      initialEmail={params.email ?? ""}
    />
  );
}
