import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import {
  Bricolage_Grotesque,
  IBM_Plex_Mono,
  Plus_Jakarta_Sans,
} from "next/font/google";
import { AuthProvider } from "@/components/providers/auth-provider";
import { MessagingProvider } from "@/components/providers/messaging-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { EnvironmentBanner } from "@/components/layout/environment-banner";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

const fontBody = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin", "vietnamese"],
});

const fontDisplay = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin", "vietnamese"],
});

const fontMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// No `template` here: every page in the app already appends "— Fgrapher"
// to its own title (e.g. "Browse artists — Fgrapher"), so a title
// template would double it up. This is just the fallback for routes with
// no metadata of their own (not-found.tsx, error.tsx) — locale-aware via
// next-intl rather than a hardcoded English string, per CLAUDE.md rule 10.
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
  const messages = await getMessages();

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
          Skip to main content
        </a>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <AuthProvider>
              <MessagingProvider>
                <Toaster>{children}</Toaster>
              </MessagingProvider>
            </AuthProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
