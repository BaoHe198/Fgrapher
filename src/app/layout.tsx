import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Bricolage_Grotesque, IBM_Plex_Mono, Lexend } from "next/font/google";
import { AuthProvider } from "@/components/providers/auth-provider";
import { BadgesProvider } from "@/components/providers/badges-provider";
import { MessagingProvider } from "@/components/providers/messaging-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { CookieConsentBanner } from "@/components/layout/cookie-consent-banner";
import { EnvironmentBanner } from "@/components/layout/environment-banner";
import { Toaster } from "@/components/ui/toast";
import { CLIENT_MESSAGE_SCOPES } from "@/i18n/client-message-scopes.generated";
import { pickMessages, type MessageTree } from "@/i18n/pick-messages";
import { auth } from "@/lib/auth";
import { features } from "@/lib/features";
import { readCookieConsent } from "@/lib/privacy/cookie-consent-server";
import "./globals.css";

const fontBody = Lexend({
  variable: "--font-body",
  subsets: ["latin", "vietnamese"],
});

const fontDisplay = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin", "vietnamese"],
});

// Not preloaded (27/11/2026). A font declared here is preloaded on every
// route, and this one is three files (one per weight) used only for small
// labels and codes. On a slow connection those files competed with the page
// itself for the line before anything was painted. They still load where the
// font is used; until then the label shows in the system monospace font.
const fontMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  preload: false,
});

// No `template` here: every page in the app already appends "— Fgrapher"
// to its own title (e.g. "Browse artists — Fgrapher"), so a title
// template would double it up. This is just the fallback for routes with
// no metadata of their own (not-found.tsx, error.tsx) — locale-aware via
// next-intl rather than a hardcoded English string, per CLAUDE.md rule 10.
// viewport-fit=cover lets env(safe-area-inset-*) report the iPhone home
// indicator, which every sticky bar and sheet footer pads for.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("seo.default");
  return {
    title: t("title"),
    description: t("description"),
    openGraph: {
      title: t("title"),
      description: t("description"),
      locale: locale === "vi" ? "vi_VN" : "en_US",
      siteName: "Fgrapher",
    },
    twitter: {
      card: "summary",
      title: t("title"),
      description: t("description"),
    },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  // Not the whole catalogue (27/11/2026). That was 343 KB inside every
  // page's HTML, three quarters of the page. The browser gets the few
  // namespaces every page uses here, and each area's layout adds its own
  // through <ScopedMessages>. Server Components read the full catalogue
  // regardless. See scripts/gen-client-message-scopes.mjs.
  const messages = pickMessages(
    (await getMessages()) as MessageTree,
    CLIENT_MESSAGE_SCOPES.root,
  );
  const session = await auth();
  // auth() already reads the request's cookies, so reading one more keeps
  // no page static that was static before — and deciding here means the
  // banner is in the first HTML instead of popping in after hydration.
  const cookieConsent = await readCookieConsent();
  const skipLabel = (await getTranslations("nav"))("skipToContent");

  return (
    <html
      lang={locale}
      className={`${fontBody.variable} ${fontDisplay.variable} ${fontMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <EnvironmentBanner />
        <a
          href="#main-content"
          className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-50 focus-visible:rounded-[var(--fg-radius-sm)] focus-visible:bg-brand-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-text-on-brand"
        >
          {skipLabel}
        </a>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <AuthProvider session={session}>
              <BadgesProvider>
                <MessagingProvider>
                  <Toaster>{children}</Toaster>
                </MessagingProvider>
              </BadgesProvider>
              <CookieConsentBanner
                initialAnalytics={cookieConsent?.analytics ?? null}
              />
            </AuthProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
        {/* Page-view analytics: only when the owner has switched it on AND
            this visitor allowed analytics cookies (checklist #13; see
            VERCEL_ANALYTICS_ENABLED in lib/env.ts for what has to happen
            before switching it on). */}
        {features.vercelAnalyticsEnabled && cookieConsent?.analytics ? (
          <Analytics />
        ) : null}
      </body>
    </html>
  );
}
