"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import {
  CallSheet,
  type CallSheetData,
} from "@/components/requests/call-sheet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// "Xem ví dụ call sheet" (Core MVP pass, 02/10/2026): the example opens in a
// dialog - focus moves into it, Tab stays inside, Esc closes and focus goes
// back to the link - rather than taking half of the first screen.
export function CallSheetExample({
  data,
  stamp,
  composeHref,
}: {
  data: CallSheetData;
  stamp: string;
  composeHref: string;
}) {
  const t = useTranslations("publicPages.requestsF.example");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="lg"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {t("open")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
          </DialogHeader>
          <CallSheet code="YC-2026-00012" stamp={stamp} data={data} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("close")}
            </Button>
            <Button
              variant="primary"
              nativeButton={false}
              render={<Link href={composeHref} />}
            >
              {t("useIt")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
