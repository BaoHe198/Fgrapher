"use client";

import { Flag } from "lucide-react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { ReportModal } from "@/components/modals/report-modal";
import { Button } from "@/components/ui/button";

/**
 * "Báo thông tin sai" on a spot's page. Reports go to the admin report
 * queue, which links back to the spot's admin page. Signing in first, like
 * every report: an anonymous report cannot be followed up.
 */
export function PlaceReportButton({
  placeId,
  href,
}: {
  placeId: string;
  href: string;
}) {
  const t = useTranslations("places.detail");
  const { status } = useSession();
  const [open, setOpen] = useState(false);

  if (status !== "authenticated") {
    return (
      <Button
        variant="ghost"
        size="sm"
        nativeButton={false}
        render={
          <Link href={`/login?callbackUrl=${encodeURIComponent(href)}`} />
        }
      >
        <Flag aria-hidden />
        {t("reportSignIn")}
      </Button>
    );
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Flag aria-hidden />
        {t("report")}
      </Button>
      <ReportModal
        open={open}
        onOpenChange={setOpen}
        targetType="place"
        targetId={placeId}
      />
    </>
  );
}
