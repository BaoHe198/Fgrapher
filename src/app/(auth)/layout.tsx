import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { LogoFull } from "@/components/brand/logo-full";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";

interface AuthLayoutProps {
  children: ReactNode;
}

export default async function AuthLayout({ children }: AuthLayoutProps) {
  const t = await getTranslations("accountFlows.authLayout");
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-[72px] items-center border-b border-border-subtle px-8">
        <LogoFull />
      </header>

      <div className="grid min-h-[calc(100vh-72px)] lg:grid-cols-2">
        <div className="flex items-center justify-center px-5 py-10 sm:px-8 sm:py-14">
          <div className="flex w-full max-w-[400px] flex-col gap-[22px]">
            {children}
          </div>
        </div>

        <div className="relative hidden items-end bg-green-900 p-10 lg:flex">
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5 opacity-50">
            <MediaPlaceholder tint="green-700" height="100%" />
            <MediaPlaceholder tint="gold-700" height="100%" />
            <MediaPlaceholder tint="green-600" height="100%" />
            <MediaPlaceholder tint="neutral-700" height="100%" />
          </div>
          <blockquote className="relative flex max-w-[440px] flex-col gap-3">
            <p className="text-heading-lg text-gold-50">
              &ldquo;{t("quote")}&rdquo;
            </p>
            <span className="text-body-sm text-gold-300">{t("quoteBy")}</span>
          </blockquote>
        </div>
      </div>
    </div>
  );
}
