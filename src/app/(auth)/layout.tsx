import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { LogoFull } from "@/components/brand/logo-full";
import { ROLE_PHOTOS } from "@/lib/constants/showcase-images";

// The second photo of each role, so the auth pages don't repeat the home
// page's role tiles.
const AUTH_PHOTOS = [
  { photo: ROLE_PHOTOS.PHOTOGRAPHER[1], alt: "photographer" },
  { photo: ROLE_PHOTOS.VIDEOGRAPHER[1], alt: "videographer" },
  { photo: ROLE_PHOTOS.MAKEUP_ARTIST[1], alt: "makeupArtist" },
  { photo: ROLE_PHOTOS.STUDIO[1], alt: "studio" },
] as const;

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
        {/* The page's main landmark — the skip link had no target here. */}
        <main
          id="main-content"
          className="flex items-center justify-center px-5 py-10 sm:px-8 sm:py-14"
        >
          <div className="flex w-full max-w-[400px] flex-col gap-[22px]">
            {children}
          </div>
        </main>

        <div className="relative hidden items-end bg-green-900 p-10 lg:flex">
          {/* Self-hosted showcase photos with recorded credit
              (public/images/showcase/README.md) - these four used to be
              hotlinked from Unsplash with no record of who took them
              (owner checklist #41, 16/11/2026). */}
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5 opacity-50">
            {AUTH_PHOTOS.map(({ photo, alt }, index) => (
              <div key={photo.src} className="relative h-full w-full">
                <Image
                  src={photo.src}
                  alt={t(`imageAlt.${alt}`)}
                  fill
                  sizes="(min-width: 1024px) 400px, 0px"
                  className="object-cover"
                  // The largest element on every auth page, so the first
                  // should not wait for lazy-loading to notice it.
                  priority={index === 0}
                />
              </div>
            ))}
          </div>
          {/* Not a testimonial: Fgrapher has no users yet, so a quote
              attributed to a "verified provider" would be invented. States
              what the platform does instead, in its own voice. */}
          <div className="relative flex max-w-[440px] flex-col gap-3">
            <p className="text-heading-lg text-gold-50">{t("pitch")}</p>
            <span className="text-body-sm text-gold-300">{t("pitchSub")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
