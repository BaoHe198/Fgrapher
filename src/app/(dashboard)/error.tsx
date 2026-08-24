"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("dashboardCore.error");

  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <AlertTriangle className="size-12 text-danger" />
      <h1 className="text-heading-xl text-text-primary">{t("title")}</h1>
      <p className="max-w-md text-body-md text-text-secondary">{t("body")}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="accent" onClick={reset}>
          {t("retry")}
        </Button>
        <Button
          variant="secondary"
          nativeButton={false}
          render={<Link href="/dashboard" />}
        >
          {t("backToDashboard")}
        </Button>
      </div>
    </div>
  );
}
