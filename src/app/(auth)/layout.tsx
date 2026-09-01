import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { LogoFull } from "@/components/brand/logo-full";

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
            <div className="relative h-full w-full">
              <Image
                src="https://images.unsplash.com/photo-1497316730643-415fac54a2af?q=80&w=800&auto=format&fit=crop"
                alt={t("imageAlt.photographer")}
                fill
                sizes="(min-width: 1024px) 400px, 0px"
                className="object-cover"
              />
            </div>
            <div className="relative h-full w-full">
              <Image
                src="https://images.unsplash.com/photo-1497015289639-54688650d173?q=80&w=800&auto=format&fit=crop"
                alt={t("imageAlt.videographer")}
                fill
                sizes="(min-width: 1024px) 400px, 0px"
                className="object-cover"
              />
            </div>
            <div className="relative h-full w-full">
              <Image
                src="https://images.unsplash.com/photo-1622336889416-8d790ad807d7?q=80&w=800&auto=format&fit=crop"
                alt={t("imageAlt.makeupArtist")}
                fill
                sizes="(min-width: 1024px) 400px, 0px"
                className="object-cover"
              />
            </div>
            <div className="relative h-full w-full">
              <Image
                src="https://images.unsplash.com/photo-1617463874381-85b513b3e991?q=80&w=800&auto=format&fit=crop"
                alt={t("imageAlt.studio")}
                fill
                sizes="(min-width: 1024px) 400px, 0px"
                className="object-cover"
              />
            </div>
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
