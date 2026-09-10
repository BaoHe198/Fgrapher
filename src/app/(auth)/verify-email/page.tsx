import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { parseBillingInterval } from "@/lib/onboarding-destination";

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
  searchParams: Promise<{ token?: string; email?: string; interval?: string }>;
}

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const params = await searchParams;

  return (
    <VerifyEmailPanel
      token={params.token ?? null}
      initialEmail={params.email ?? ""}
      // The billing period chosen at signup, carried in the link because
      // it never reaches the database. Normalised rather than validated:
      // a mangled value falls back to monthly instead of blocking anyone
      // from verifying.
      interval={parseBillingInterval(params.interval)}
    />
  );
}
