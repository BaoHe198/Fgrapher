"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("rootError");

  useEffect(() => {
    // Wire up to Sentry (or another error tracker) once one is set up in
    // the project — for now this at least keeps the failure visible in
    // server/browser logs instead of silently swallowing it.
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <AlertTriangle className="size-14 text-danger" />
      <h1 className="text-display-lg text-text-primary">{t("title")}</h1>
      <p className="max-w-md text-body-md text-text-secondary">{t("body")}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="accent" onClick={reset}>
          {t("retry")}
        </Button>
        <Button
          variant="secondary"
          nativeButton={false}
          render={<Link href="/" />}
        >
          {t("home")}
        </Button>
      </div>
    </div>
  );
}
