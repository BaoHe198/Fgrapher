"use client";

import {
  Menu,
  MessageCircle,
  Moon,
  Search,
  ShoppingBag,
  Sun,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useTheme } from "next-themes";

import { LogoFull } from "@/components/brand/logo-full";
import { CartDrawer } from "@/components/cart/cart-drawer";
import {
  CommandPalette,
  CommandPaletteTrigger,
  useCommandPalette,
} from "@/components/layout/command-palette";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useMessaging } from "@/components/providers/messaging-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useMounted } from "@/hooks/use-mounted";
import { useUserRoles } from "@/hooks/use-user-roles";
import { setLocale } from "@/i18n/actions";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const WIDE_BREAKPOINT = 1180;

// Keys are relative to the "nav" namespace — both WebNav and MobileNavSheet
// scope their t() with useTranslations("nav"). The "shop" entry is spliced
// out below when MARKETPLACE_ENABLED is off; authOnly entries (Prompt G7)
// are spliced out for logged-out visitors, same reasoning as hiding the
// dashboard button itself — a link into /dashboard/* isn't useful to show
// prominently to someone who isn't signed in.
// Tạo Booking now lives only in the dashboard sidebar
const NAV_LINKS = [
  { href: "/browse", labelKey: "browse" as const, alwaysVisible: true },
  { href: "/fmap", labelKey: "fmap" as const, alwaysVisible: true },
  {
    href: "/requests",
    labelKey: "booking" as const,
    alwaysVisible: true,
    authOnly: true,
  },
  { href: "/shop", labelKey: "market" as const, alwaysVisible: false },
  {
    href: "/community",
    labelKey: "community" as const,
    alwaysVisible: false,
  },
  // Not always visible: on a 768px tablet, signed in, it pushed the header
  // 6px past the screen edge (25/09 audit). The footer links it anyway.
  { href: "/about", labelKey: "introduce" as const, alwaysVisible: false },
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

export function WebNav({
  marketplaceEnabled,
  socialFeedEnabled,
}: {
  marketplaceEnabled: boolean;
  socialFeedEnabled: boolean;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const isWide = useIsWide();
  const { data: session } = useSession();
  const { isAuthenticated } = useUserRoles();
  const messaging = useMessaging();

  const navLinks = NAV_LINKS.filter(
    (link) =>
      (marketplaceEnabled || link.href !== "/shop") &&
      (socialFeedEnabled || link.href !== "/community") &&
      (!link.authOnly || isAuthenticated),
  );
  const links = isWide
    ? navLinks
    : navLinks.filter((link) => link.alwaysVisible);

  return (
    <CommandPalette
      isAuthenticated={isAuthenticated}
      marketplaceEnabled={marketplaceEnabled}
      socialFeedEnabled={socialFeedEnabled}
    >
      <header
        className="sticky top-0 z-20 border-b border-border-subtle backdrop-blur-[14px] transition-[background-color,border-color,color] duration-[var(--fg-dur-260)] ease-fg-out"
        style={{
          background: "color-mix(in srgb, var(--bg-surface) 88%, transparent)",
        }}
      >
        {/* Desktop / tablet row (>=768px) — collapses which links show at 1180px */}
        <div className="mx-auto hidden h-[72px] max-w-[1440px] items-center gap-6 px-6 md:flex">
          <LogoFull className="shrink-0" />

          <nav className="flex items-center gap-[18px]">
            {links.map((link) => {
              const isActive = pathname === link.href.split("?")[0];
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "text-body-md font-semibold! whitespace-nowrap",
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
                {isAuthenticated ? (
                  <button
                    type="button"
                    onClick={messaging.toggle}
                    className="relative"
                    aria-label={t("messagesAria")}
                  >
                    <MessageCircle className="size-5 text-text-secondary" />
                    {messaging.unreadCount > 0 ? (
                      <span className="absolute -top-1 -right-1 size-2 rounded-full bg-danger" />
                    ) : null}
                  </button>
                ) : (
                  <MessageCircle className="size-5 text-text-secondary" />
                )}
                {marketplaceEnabled ? (
                  isAuthenticated ? (
                    <CartDrawer />
                  ) : (
                    <Link href="/shop">
                      <ShoppingBag className="size-5 text-text-secondary" />
                    </Link>
                  )
                ) : null}
              </>
            ) : null}

            <CommandPaletteTrigger compact={!isWide} />
            <ThemeToggle />
            <LangToggle />

            {isAuthenticated ? (
              <>
                <NotificationBell />
                <Button
                  variant="secondary"
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/dashboard" />}
                >
                  {t("dashboard")}
                </Button>
                <UserMenu session={session} />
              </>
            ) : (
              <Button
                variant="accent"
                size="sm"
                nativeButton={false}
                render={<Link href="/login" />}
              >
                {t("authCta")}
              </Button>
            )}
          </div>
        </div>

        {/* Phones (<768px, Core MVP pass 02/10/2026): logo, the cart when
          Chợ F is on, and the menu - nothing else. Search, sign-in and the
          rest live at the top of the menu, so the page's own gold button
          is the only gold on screen. */}
        <div className="flex h-[72px] items-center justify-between gap-2 px-4 md:hidden">
          <LogoFull
            size={24}
            className="min-w-0 max-[389px]:gap-2 max-[389px]:[&_span]:text-heading-md"
          />
          <div className="flex items-center gap-2">
            {marketplaceEnabled ? (
              isAuthenticated ? (
                <CartDrawer />
              ) : (
                <Link
                  href="/shop"
                  aria-label={t("market")}
                  className="focus-ring grid size-11 place-items-center rounded-full"
                >
                  <ShoppingBag className="size-5 text-text-secondary" />
                </Link>
              )
            ) : null}
            <MobileNavSheet
              session={session}
              isAuthenticated={isAuthenticated}
              marketplaceEnabled={marketplaceEnabled}
              socialFeedEnabled={socialFeedEnabled}
            />
          </div>
        </div>
      </header>
    </CommandPalette>
  );
}

function UserMenu({
  session,
}: {
  session: ReturnType<typeof useSession>["data"];
}) {
  const t = useTranslations("nav");
  const { isPaid } = useUserRoles();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus">
        <Avatar className="size-[34px]">
          {session?.user?.avatar ? (
            <AvatarImage
              src={session.user.avatar}
              alt={session.user.name ?? ""}
            />
          ) : null}
          <AvatarFallback>
            {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* Providers had no way to see the page customers see. */}
        {isPaid ? (
          <DropdownMenuItem render={<Link href="/profile/me" />}>
            {t("viewPublicProfile")}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem render={<Link href="/dashboard/settings" />}>
          {t("settings")}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/dashboard/settings/billing" />}>
          {t("billing")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          {t("signout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileNavSheet({
  session,
  isAuthenticated,
  marketplaceEnabled,
  socialFeedEnabled,
}: {
  session: ReturnType<typeof useSession>["data"];
  isAuthenticated: boolean;
  marketplaceEnabled: boolean;
  socialFeedEnabled: boolean;
}) {
  const t = useTranslations("nav");
  const ts = useTranslations("sharedComponents.webNav");
  const tp = useTranslations("sharedComponents.commandPalette");
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const messaging = useMessaging();
  const palette = useCommandPalette();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { isPaid } = useUserRoles();
  const navLinks = NAV_LINKS.filter(
    (link) =>
      (marketplaceEnabled || link.href !== "/shop") &&
      (socialFeedEnabled || link.href !== "/community") &&
      (!link.authOnly || isAuthenticated),
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            ref={menuButtonRef}
            variant="ghost"
            size="icon"
            className="size-11"
          >
            <Menu className="size-5" />
            <span className="sr-only">{ts("openNavigation")}</span>
          </Button>
        }
      />
      <SheetContent side="right" className="w-3/4 sm:max-w-xs">
        <SheetHeader className="sr-only">
          <SheetTitle>{ts("navigationTitle")}</SheetTitle>
          <SheetDescription>{ts("navigationDescription")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-2 px-4 pt-14">
          {palette ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                palette.openPalette(menuButtonRef.current);
              }}
              className="focus-ring flex min-h-11 items-center gap-2.5 rounded-full border border-border-default bg-bg-surface px-4 text-left text-body-md text-text-secondary"
            >
              <Search aria-hidden className="size-4 shrink-0" />
              {tp("triggerLabel")}
            </button>
          ) : null}
          {isAuthenticated ? (
            <Button
              variant="primary"
              size="lg"
              nativeButton={false}
              onClick={() => setOpen(false)}
              render={<Link href="/dashboard" />}
            >
              {t("dashboard")}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              nativeButton={false}
              className="w-full"
              onClick={() => setOpen(false)}
              render={<Link href="/login" />}
            >
              {t("authCta")}
            </Button>
          )}
        </div>

        <nav className="flex flex-col gap-1 p-4">
          {navLinks.map((link) => {
            const isActive = pathname === link.href.split("?")[0];
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "focus-ring flex min-h-11 items-center rounded-[var(--fg-radius-sm)] px-3 text-body-md font-semibold!",
                  isActive ? "text-text-primary" : "text-text-secondary",
                )}
              >
                {t(link.labelKey)}
              </Link>
            );
          })}
          <Link
            href="/pricing"
            onClick={() => setOpen(false)}
            className="focus-ring flex min-h-11 items-center rounded-[var(--fg-radius-sm)] px-3 text-body-md font-semibold! text-text-secondary"
          >
            {t("providers")}
          </Link>
        </nav>

        <div className="flex items-center gap-3 border-t border-border-subtle px-4 py-4">
          <ThemeToggle className="size-11" />
          <LangToggle className="[&_button]:min-h-11" />
        </div>

        {isAuthenticated && session?.user ? (
          <div className="flex flex-col gap-1 border-t border-border-subtle px-4 py-4">
            <div className="flex items-center gap-2.5 pb-3">
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
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                messaging.toggle();
              }}
              className="focus-ring flex min-h-11 items-center gap-2 rounded-[var(--fg-radius-sm)] px-3 text-left text-body-md font-semibold! text-text-secondary"
            >
              {t("messages")}
              {messaging.unreadCount > 0 ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-sm font-bold text-text-on-brand">
                  {messaging.unreadCount}
                </span>
              ) : null}
            </button>
            {isPaid ? (
              <Link
                href="/profile/me"
                onClick={() => setOpen(false)}
                className="focus-ring flex min-h-11 items-center rounded-[var(--fg-radius-sm)] px-3 text-body-md font-semibold! text-text-secondary"
              >
                {t("viewPublicProfile")}
              </Link>
            ) : null}
            <Link
              href="/dashboard/notifications"
              onClick={() => setOpen(false)}
              className="focus-ring flex min-h-11 items-center rounded-[var(--fg-radius-sm)] px-3 text-body-md font-semibold! text-text-secondary"
            >
              {ts("notifications")}
            </Link>
            <Link
              href="/dashboard/settings"
              onClick={() => setOpen(false)}
              className="focus-ring flex min-h-11 items-center rounded-[var(--fg-radius-sm)] px-3 text-body-md font-semibold! text-text-secondary"
            >
              {t("settings")}
            </Link>
            <Link
              href="/dashboard/settings/billing"
              onClick={() => setOpen(false)}
              className="focus-ring flex min-h-11 items-center rounded-[var(--fg-radius-sm)] px-3 text-body-md font-semibold! text-text-secondary"
            >
              {t("billing")}
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="focus-ring flex min-h-11 items-center rounded-[var(--fg-radius-sm)] px-3 text-left text-body-md font-semibold! text-danger"
            >
              {t("signout")}
            </button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ThemeToggle({ className }: { className?: string }) {
  const ts = useTranslations("sharedComponents.webNav");
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "flex size-9 items-center justify-center rounded-full border border-border-subtle bg-bg-surface transition-colors duration-150",
        className,
      )}
      aria-label={ts("toggleTheme")}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

function LangToggle({ className }: { className?: string }) {
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
    <div
      className={cn(
        "inline-flex overflow-hidden rounded-full border border-border-subtle bg-bg-surface",
        className,
      )}
    >
      {routing.locales.map((code) => (
        <button
          key={code}
          type="button"
          disabled={isPending}
          onClick={() => handleSelect(code)}
          className={cn(
            "px-3 py-[7px] text-body-sm font-bold! transition-colors duration-150 disabled:opacity-50",
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
