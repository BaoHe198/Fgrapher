"use client";

import {
  Check,
  Globe,
  Menu,
  MessageCircle,
  Moon,
  Search,
  ShoppingBag,
  Sun,
  UserRound,
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
  // Photo spots (services/places.ts): listed only once one is public, the
  // same rule as the pages themselves.
  {
    href: "/dia-diem",
    labelKey: "places" as const,
    alwaysVisible: false,
    placesOnly: true,
  },
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
  // Guests only in the desktop row: once Địa điểm chụp joined, a signed-in
  // visitor's row (which also has Đặt lịch F and three icons) ran up to
  // 114px off the screen at 1180, 1440 and 1536px (23/11/2026). It is for
  // people deciding whether to join; the phone menu and footer keep it.
  {
    href: "/about",
    labelKey: "introduce" as const,
    alwaysVisible: false,
    desktopGuestOnly: true,
  },
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
  placesEnabled = false,
}: {
  marketplaceEnabled: boolean;
  socialFeedEnabled: boolean;
  /** At least one photo spot is public. */
  placesEnabled?: boolean;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const isWide = useIsWide();
  const { data: session } = useSession();
  const { isAuthenticated, isPaid } = useUserRoles();
  const messaging = useMessaging();

  const navLinks = NAV_LINKS.filter(
    (link) =>
      (marketplaceEnabled || link.href !== "/shop") &&
      (socialFeedEnabled || link.href !== "/community") &&
      (placesEnabled || !("placesOnly" in link)) &&
      (!("authOnly" in link) || isAuthenticated) &&
      (!("desktopGuestOnly" in link) || !isAuthenticated),
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
        {/* Desktop / tablet row (>=768px), Airbnb's header (owner,
            17/11/2026): the logo on the left, the sections as tabs in the
            middle, and on the right the provider call, a few icons, a globe
            for language and theme, and one round "menu + avatar" button
            that holds the account. Which tabs show still collapses at
            1180px. */}
        <div className="mx-auto hidden h-[80px] max-w-[1440px] items-center gap-4 px-6 md:flex lg:px-8">
          <div className="flex flex-1 items-center">
            <LogoFull className="shrink-0" />
          </div>

          <nav
            aria-label={t("sectionsLabel")}
            className="flex items-center gap-1"
          >
            {links.map((link) => {
              const isActive = pathname === link.href.split("?")[0];
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    // Tighter below 1366px: with every section switched on
                    // the row was wider than a 1180-1280px window and the
                    // page scrolled sideways (measured 19/11/2026).
                    "focus-ring rounded-full px-3 py-2.5 text-body-md whitespace-nowrap transition-colors duration-[var(--fg-dur-150)] hover:bg-bg-sunken min-[1366px]:px-4",
                    isActive
                      ? "font-semibold! text-text-primary"
                      : "text-text-secondary hover:text-text-primary",
                  )}
                >
                  {t(link.labelKey)}
                </Link>
              );
            })}
          </nav>

          <div className="flex flex-1 items-center justify-end gap-1">
            {isPaid ? (
              <Link
                href="/dashboard"
                // From 1440px, like "become a provider" for a signed-in
                // visitor: once the Địa điểm chụp tab joined the row, a
                // provider at 1366px had the search and account buttons
                // pushed 126px off the screen (23/11/2026). The account menu
                // carries the same link.
                className="focus-ring hidden rounded-full px-4 py-2.5 text-body-md whitespace-nowrap text-text-primary transition-colors duration-[var(--fg-dur-150)] hover:bg-bg-sunken min-[1440px]:inline-flex"
              >
                {t("dashboard")}
              </Link>
            ) : (
              <Link
                href="/pricing"
                className={cn(
                  "focus-ring hidden rounded-full px-4 py-2.5 text-body-md whitespace-nowrap text-text-primary transition-colors duration-[var(--fg-dur-150)] hover:bg-bg-sunken",
                  // This side also holds the icons and the account pill.
                  // Shown from "lg" the row overflowed: by 36px at 1366px
                  // for a signed-in customer (who has the messages, cart
                  // and bell icons too), by up to 168px between 1180 and
                  // 1280px for everyone (measured 19/11/2026). The account
                  // menu carries the same link, so it waits for room.
                  isAuthenticated
                    ? "min-[1440px]:inline-flex"
                    : "min-[1366px]:inline-flex",
                )}
              >
                {t("becomeProvider")}
              </Link>
            )}
            {isWide && isAuthenticated ? (
              <button
                type="button"
                onClick={messaging.toggle}
                className="focus-ring relative grid size-10 place-items-center rounded-full hover:bg-bg-sunken"
                aria-label={t("messagesAria")}
              >
                <MessageCircle className="size-5 text-text-secondary" />
                {messaging.unreadCount > 0 ? (
                  <span className="absolute top-2 right-2 size-2 rounded-full bg-danger" />
                ) : null}
              </button>
            ) : null}
            {isWide && marketplaceEnabled ? (
              isAuthenticated ? (
                <CartDrawer />
              ) : (
                <Link
                  href="/shop"
                  aria-label={t("market")}
                  className="focus-ring grid size-10 place-items-center rounded-full hover:bg-bg-sunken"
                >
                  <ShoppingBag className="size-5 text-text-secondary" />
                </Link>
              )
            ) : null}
            {isAuthenticated ? <NotificationBell /> : null}
            <CommandPaletteTrigger compact />
            <GlobeMenu />
            <AccountMenu session={session} isAuthenticated={isAuthenticated} />
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
              placesEnabled={placesEnabled}
            />
          </div>
        </div>
      </header>
    </CommandPalette>
  );
}

// Airbnb's account button: a pill with the menu icon and the avatar (a
// person icon before sign-in). Everything about the account lives in it,
// so the header stays quiet: sign in or up for a guest; bookings,
// messages, saved, settings and sign out once signed in.
function AccountMenu({
  session,
  isAuthenticated,
}: {
  session: ReturnType<typeof useSession>["data"];
  isAuthenticated: boolean;
}) {
  const t = useTranslations("nav");
  const { isPaid } = useUserRoles();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("accountMenu")}
        className="focus-ring ml-1 flex items-center gap-2.5 rounded-full border border-border-default bg-bg-surface py-1.5 pr-1.5 pl-3.5 transition-shadow duration-[var(--fg-dur-150)] hover:shadow-[var(--shadow-md)]"
      >
        <Menu aria-hidden className="size-4 text-text-primary" />
        <Avatar className="size-8">
          {session?.user?.avatar ? (
            <AvatarImage
              src={session.user.avatar}
              alt={session.user.name ?? ""}
            />
          ) : null}
          <AvatarFallback className="bg-text-secondary text-bg-page">
            {isAuthenticated ? (
              (session?.user?.name?.[0]?.toUpperCase() ?? "?")
            ) : (
              <UserRound aria-hidden className="size-4" />
            )}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-60">
        {isAuthenticated ? (
          <>
            <DropdownMenuItem
              className="font-semibold"
              render={<Link href="/dashboard/bookings" />}
            >
              {t("myBookings")}
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/dashboard/messages" />}>
              {t("messages")}
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/saved" />}>
              {t("saved")}
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/moodboard" />}>
              {t("moodboard")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* Providers had no way to see the page customers see. */}
            {isPaid ? (
              <DropdownMenuItem render={<Link href="/profile/me" />}>
                {t("viewPublicProfile")}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem render={<Link href="/dashboard" />}>
              {t("dashboard")}
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/dashboard/settings" />}>
              {t("settings")}
            </DropdownMenuItem>
            <DropdownMenuItem
              render={<Link href="/dashboard/settings/billing" />}
            >
              {t("billing")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/help" />}>
              {t("help")}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              {t("signout")}
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem
              className="font-semibold"
              render={<Link href="/login" />}
            >
              {t("signin")}
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/register" />}>
              {t("register")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/pricing" />}>
              {t("becomeProvider")}
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/help" />}>
              {t("help")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Airbnb's globe: language, and here the light/dark switch too, in one
// small menu instead of two always-visible controls.
function GlobeMenu() {
  const t = useTranslations("nav");
  const ts = useTranslations("sharedComponents.webNav");
  const locale = useLocale();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === "dark";

  const pickLocale = (next: (typeof routing.locales)[number]) => {
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("languageAndTheme")}
        className="focus-ring grid size-10 place-items-center rounded-full hover:bg-bg-sunken"
      >
        <Globe aria-hidden className="size-5 text-text-primary" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {routing.locales.map((code) => (
          <DropdownMenuItem
            key={code}
            onClick={() => pickLocale(code)}
            className={code === locale ? "font-semibold" : undefined}
          >
            {t(`language.${code}`)}
            {code === locale ? (
              <Check aria-hidden className="ml-auto size-4" />
            ) : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setTheme(isDark ? "light" : "dark")}>
          {isDark ? (
            <Sun aria-hidden className="size-4" />
          ) : (
            <Moon aria-hidden className="size-4" />
          )}
          {isDark ? ts("lightMode") : ts("darkMode")}
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
  placesEnabled,
}: {
  session: ReturnType<typeof useSession>["data"];
  isAuthenticated: boolean;
  marketplaceEnabled: boolean;
  socialFeedEnabled: boolean;
  placesEnabled: boolean;
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
      (placesEnabled || !("placesOnly" in link)) &&
      (!("authOnly" in link) || isAuthenticated),
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
