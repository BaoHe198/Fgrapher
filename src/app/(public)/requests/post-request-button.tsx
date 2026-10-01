"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const COMPOSE = "/requests/new";

// "Đăng yêu cầu". Signed in, it goes straight to question 01. Signed out,
// the page stays readable and only this button asks for an account (wave 2
// decision) - with the existing email sign-in, not the phone OTP the
// design sketched, and back to question 01 afterwards.
export function PostRequestButton({
  isAuthenticated,
  size = "lg",
}: {
  isAuthenticated: boolean;
  size?: "md" | "lg";
}) {
  const t = useTranslations("publicPages.requestsF");
  const [open, setOpen] = useState(false);

  if (isAuthenticated) {
    return (
      <Button
        variant="accent"
        size={size}
        nativeButton={false}
        render={<Link href={COMPOSE} />}
      >
        {t("post")}
      </Button>
    );
  }

  const callback = encodeURIComponent(COMPOSE);
  return (
    <>
      <Button variant="accent" size={size} onClick={() => setOpen(true)}>
        {t("post")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <span className="font-mono text-meta tracking-[0.12em] text-text-tertiary uppercase">
              {t("login.eyebrow")}
            </span>
            <DialogTitle>{t("login.title")}</DialogTitle>
            <DialogDescription>{t("login.body")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="accent"
              size="lg"
              nativeButton={false}
              className="flex-1"
              render={<Link href={`/login?callbackUrl=${callback}`} />}
            >
              {t("login.signIn")}
            </Button>
            <Button
              variant="outline"
              size="lg"
              nativeButton={false}
              className="flex-1"
              render={
                <Link href={`/login?mode=register&callbackUrl=${callback}`} />
              }
            >
              {t("login.register")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
