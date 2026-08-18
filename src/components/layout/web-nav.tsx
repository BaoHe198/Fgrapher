"use client";

import { Menu, MessageCircle, Moon, ShoppingBag, Sun } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { useTheme } from "next-themes";

import { LogoFull } from "@/components/brand/logo-full";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { setLocale } from "@/i18n/actions";
import { routing } from "@/i18n/routing";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";

const WIDE_BREAKPOINT = 1180;

// Keys are relative to the "nav" namespace — both WebNav and MobileNavSheet
// scope their t() with useTranslations("nav").
const NAV_LINKS = [
  { href: "/browse", labelKey: "browse" as const, alwaysVisible: true },
  {
    href: "/browse?role=STUDIO",
    labelKey: "studios" as const,
    alwaysVisible: false,
  },
  { href: "/shop", labelKey: "shop" as const, alwaysVisible: false },
  { href: "/pricing", labelKey: "pricing" as const, alwaysVisible: true },
];

function subscribeResize(callback: () => void) {
  window.addEventListener("resize", callback);
  return () => window.removeEventListener("resize", callback);
}

function useIsWide() {
  return useSyncExternalStore(
    subscribeResize,
    () => window.innerWidth >= WIDE_BREAKPOINT,
    () => false,
  );
}

export function WebNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const isWide = useIsWide();
  const { data: session } = useSession();

  const links = isWide
    ? NAV_LINKS
    : NAV_LINKS.filter((link) => link.alwaysVisible);

  return (
    <header
      className="sticky top-0 z-20 border-b border-border-subtle backdrop-blur-[14px]"
      style={{
        background: "color-mix(in srgb, var(--bg-surface) 88%, transparent)",
      }}
    >
      {/* Desktop / tablet row (>=640px) — collapses which links show at 1180px */}
      <div className="mx-auto hidden h-[72px] max-w-[1240px] items-center gap-6 px-6 sm:flex">
        <LogoFull className="shrink-0" />

        <nav className="flex items-center gap-[18px]">
          {links.map((link) => {
            const isActive = pathname === link.href.split("?")[0];
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-body-md font-semibold",
                  isActive ? "text-text-primary" : "text-text-secondary",
                )}
              >
                {t(link.labelKey)}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {isWide ? (
            <>
              <MessageCircle className="size-5 text-text-secondary" />
              <ShoppingBag className="size-5 text-text-secondary" />
            </>
          ) : null}

          <ThemeToggle />
          <LangToggle />

          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/login" />}
          >
            {t("signin")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            nativeButton={false}
            render={<Link href="/dashboard" />}
          >
            {t("dashboard")}
          </Button>

          {session?.user ? (
            <Avatar className="size-[34px]">
              {session.user.avatar ? (
                <AvatarImage
                  src={session.user.avatar}
                  alt={session.user.name ?? ""}
                />
              ) : null}
              <AvatarFallback>
                {session.user.name?.[0]?.toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>
          ) : null}
        </div>
      </div>

      {/* Mobile row (<640px) — logo + hamburger, everything else moves into a Sheet */}
      <div className="flex h-[72px] items-center justify-between px-4 sm:hidden">
        <LogoFull />
        <MobileNavSheet session={session} />
      </div>
    </header>
  );
}

function MobileNavSheet({
  session,
}: {
  session: ReturnType<typeof useSession>["data"];
}) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon">
            <Menu className="size-5" />
            <span className="sr-only">Open navigation</span>
          </Button>
        }
      />
      <SheetContent side="right" className="w-3/4 sm:max-w-xs">
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>Main site navigation</SheetDescription>
        </SheetHeader>

        <nav className="flex flex-col gap-1 p-4">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href.split("?")[0];
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-[var(--fg-radius-sm)] px-3 py-2 text-body-md font-semibold",
                  isActive ? "text-text-primary" : "text-text-secondary",
                )}
              >
                {t(link.labelKey)}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 border-t border-border-subtle px-4 py-4">
          <ThemeToggle />
          <LangToggle />
        </div>

        <div className="flex flex-col gap-2 px-4 pb-4">
          <Button
            variant="secondary"
            nativeButton={false}
            render={<Link href="/login" />}
          >
            {t("signin")}
          </Button>
          <Button
            variant="primary"
            nativeButton={false}
            render={<Link href="/dashboard" />}
          >
            {t("dashboard")}
          </Button>
        </div>

        {session?.user ? (
          <div className="flex items-center gap-2.5 border-t border-border-subtle px-4 py-4">
            <Avatar className="size-[34px]">
              {session.user.avatar ? (
                <AvatarImage
                  src={session.user.avatar}
                  alt={session.user.name ?? ""}
                />
              ) : null}
              <AvatarFallback>
                {session.user.name?.[0]?.toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>
            <span className="text-body-sm text-text-secondary">
              {session.user.name}
            </span>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex size-9 items-center justify-center rounded-full border border-border-subtle bg-bg-surface transition-colors duration-150"
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

function LangToggle() {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSelect = (nextLocale: (typeof routing.locales)[number]) => {
    if (nextLocale === locale) return;
    startTransition(async () => {
      await setLocale(nextLocale);
      router.refresh();
    });
  };

  return (
    <div className="inline-flex overflow-hidden rounded-full border border-border-subtle bg-bg-surface">
      {routing.locales.map((code) => (
        <button
          key={code}
          type="button"
          disabled={isPending}
          onClick={() => handleSelect(code)}
          className={cn(
            "px-3 py-[7px] text-body-sm font-bold transition-colors duration-150 disabled:opacity-50",
            locale === code
              ? "bg-brand-primary text-text-on-brand"
              : "text-text-secondary",
          )}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
