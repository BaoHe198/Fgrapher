"use client";

import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Eye,
  MapPin,
  MessageCircle,
  Star,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { LogoFull } from "@/components/brand/logo-full";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FgImage } from "@/components/ui/fg-image";
import { SectionNav } from "@/components/ui/section-nav";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import type { ResponseBucket } from "@/lib/response-time";
import { cn, formatCurrency } from "@/lib/utils";

import { LinkCalendar } from "./link-calendar";
import { LinkPackages, type LinkService } from "./link-packages";
import { LinkReviews, type LinkReview } from "./link-reviews";
import { LinkTerms } from "./link-terms";

export interface LinkLandingProps {
  providerId: string;
  username: string;
  /** Set only when the account has several profiles, to keep links on this one. */
  roleParam: string | null;
  roleLabel: string;
  /** How the page addresses the provider: a first name, or a studio's name. */
  callName: string;
  displayName: string;
  avatar: string | null;
  coverImage: string | null;
  place: string | null;
  description: string | null;
  isVerified: boolean;
  verifiedAt: string | null;
  phoneVerified: boolean;
  joinedAt: string;
  acceptingBookings: boolean;
  isOwnProfile: boolean;
  signedIn: boolean;
  rating: {
    average: number;
    count: number;
    breakdown: { stars: number; count: number; percent: number }[];
  };
  reviews: LinkReview[];
  completedShoots: number;
  yearsExperience: number | null;
  response: ResponseBucket | null;
  services: LinkService[];
  priceFrom: number | null;
  policies: {
    depositPercent: number | null;
    depositPolicy: string | null;
    cancellationPolicy: string | null;
    reschedulePolicy: string | null;
  };
  area: {
    location: string | null;
    radiusKm: number | null;
    nationwide: boolean;
  };
  photos: { id: string; url: string; albumTitle: string }[];
  sunPoint: { latitude: number; longitude: number } | null;
  minNoticeHours: number;
}

const NAV_HEIGHT = 52;

function scrollToSection(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const top = target.getBoundingClientRect().top + window.scrollY - NAV_HEIGHT;
  window.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
}

function Step({
  id,
  index,
  total,
  title,
  intro,
  first = false,
  children,
}: {
  id: string;
  first?: boolean;
  index: number;
  total: number;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(
        "scroll-mt-[60px] py-10",
        // The step bar above the first section already draws a rule.
        first ? null : "border-t border-border-subtle",
      )}
    >
      <p className="text-meta font-semibold! tracking-[0.14em] text-text-tertiary tabular-nums uppercase">
        {String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </p>
      <h2
        id={`${id}-title`}
        className="mt-1 text-display-md text-balance text-text-primary"
      >
        {title}
      </h2>
      {intro ? (
        <p className="mt-2 max-w-[560px] text-body-md text-text-secondary">
          {intro}
        </p>
      ) : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

// The page a provider's own link and QR code open. Someone arriving from a
// TikTok bio or a Zalo chat already half-knows this person; what they still
// need, in order: is this the real one, what do others say, what does it
// cost, what is asked of me, when are they free - and then one tap to ask
// or to book. Each step is a section of one scrolling page with a sticky
// step bar, so the order is suggested but never enforced.
export function LinkLanding(props: LinkLandingProps) {
  const {
    providerId,
    username,
    roleParam,
    roleLabel,
    callName,
    displayName,
    avatar,
    coverImage,
    place,
    description,
    isVerified,
    acceptingBookings,
    isOwnProfile,
    signedIn,
    rating,
    completedShoots,
    yearsExperience,
    response,
    services,
    priceFrom,
    photos,
  } = props;
  const t = useTranslations("linkPage");

  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    services.length === 1 ? (services[0]?.id ?? null) : null,
  );
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const selectedService =
    services.find((s) => s.id === selectedServiceId) ?? null;

  const roleQuery = roleParam ? `?role=${roleParam}` : "";
  const profileHref = `/profile/${username}${roleQuery}`;

  // Chat needs an account. The proxy's own sign-in redirect keeps only the
  // path, which would drop who to message and the drafted question, so the
  // sign-in hop is built here with the whole URL.
  const messageHref = useMemo(() => {
    const params = new URLSearchParams({ to: providerId, consult: "1" });
    if (selectedService) params.set("pkg", selectedService.name.slice(0, 120));
    if (date) params.set("day", date);
    const href = `/dashboard/messages?${params.toString()}`;
    return signedIn ? href : `/login?callbackUrl=${encodeURIComponent(href)}`;
  }, [providerId, selectedService, date, signedIn]);
  const bookHref = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedServiceId) params.set("service", selectedServiceId);
    if (date) params.set("date", date);
    if (time) params.set("time", time);
    const query = params.toString();
    return `/booking/${providerId}${query ? `?${query}` : ""}`;
  }, [providerId, selectedServiceId, date, time]);

  // The sticky bar carries the two actions once the hero's own buttons have
  // scrolled away, and steps aside while the last section - which holds the
  // same two actions, larger - is on screen.
  const [heroCtaGone, setHeroCtaGone] = useState(false);
  const [contactInView, setContactInView] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const hero = document.getElementById("link-hero-cta");
    const contact = document.getElementById("contact");
    const observers: IntersectionObserver[] = [];
    if (hero) {
      const o = new IntersectionObserver(([entry]) => {
        if (entry)
          setHeroCtaGone(
            !entry.isIntersecting && entry.boundingClientRect.top < 0,
          );
      });
      o.observe(hero);
      observers.push(o);
    }
    if (contact) {
      const o = new IntersectionObserver(
        ([entry]) => setContactInView(entry?.isIntersecting ?? false),
        { rootMargin: "0px 0px -96px 0px" },
      );
      o.observe(contact);
      observers.push(o);
    }
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const onPickService = (id: string) => {
    setSelectedServiceId(id);
    // A longer package can leave a chosen start time without room.
    setTime(null);
    scrollToSection("calendar");
  };

  const priceLabel = priceFrom
    ? t("hero.from", { price: formatCurrency(priceFrom) })
    : null;
  const ratingLabel =
    rating.count > 0
      ? t("hero.rating", {
          rating: rating.average.toFixed(1).replace(".", ","),
          count: rating.count,
        })
      : t("hero.new");
  const heroFacts = [
    completedShoots > 0 ? t("hero.shoots", { count: completedShoots }) : null,
    yearsExperience ? t("hero.years", { count: yearsExperience }) : null,
    response
      ? t(`hero.response.${response.unit}`, { count: response.value })
      : null,
  ].filter(Boolean) as string[];

  const steps = [
    { id: "reviews", label: t("nav.reviews") },
    { id: "prices", label: t("nav.prices") },
    { id: "terms", label: t("nav.terms") },
    { id: "calendar", label: t("nav.calendar") },
    { id: "contact", label: t("nav.contact") },
  ];
  const total = steps.length;

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border-subtle bg-bg-page">
        <div className="mx-auto flex h-14 w-full max-w-[760px] items-center justify-between gap-3 px-4 sm:px-6">
          <LogoFull size={24} />
          <Link
            href={profileHref}
            className="focus-ring inline-flex min-h-11 items-center gap-1.5 text-body-sm font-semibold! text-text-secondary hover:text-text-primary"
          >
            {t("header.fullProfile")}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </header>

      {isOwnProfile ? (
        <div className="border-b border-gold-400 bg-gold-50 dark:border-gold-700 dark:bg-gold-900/30">
          <div className="mx-auto flex w-full max-w-[760px] flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="flex items-center gap-2 text-body-sm text-text-primary">
              <Eye aria-hidden className="size-4 shrink-0" />
              {t("own.body")}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="self-start sm:self-auto"
              nativeButton={false}
              render={<Link href="/dashboard/share" />}
            >
              {t("own.action")}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-[760px] px-4 pb-[calc(112px+env(safe-area-inset-bottom))] sm:px-6 lg:pb-16">
        <section aria-labelledby="link-name" className="pt-4 pb-10">
          <div className="relative overflow-hidden rounded-[var(--fg-radius-xl)] bg-bg-sunken">
            <FgImage
              src={coverImage}
              alt={t("hero.coverAlt", { name: displayName })}
              ratio="16/9"
              rounded="none"
              priority
              sizes="(min-width: 768px) 760px, 100vw"
              className="animate-cover-settle"
            />
          </div>
          <div className="-mt-10 px-4">
            <Avatar className="size-20 ring-4 ring-bg-page">
              {avatar ? <AvatarImage src={avatar} alt="" /> : null}
              <AvatarFallback className="text-heading-lg">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="mt-3 flex flex-col gap-3">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-text-secondary">
              <span>{roleLabel}</span>
              {place ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin aria-hidden className="size-3.5" />
                  {place}
                </span>
              ) : null}
              {isVerified ? (
                <span className="inline-flex items-center gap-1 font-semibold! text-gold-700 dark:text-gold-400">
                  <BadgeCheck aria-hidden className="size-4" />
                  {t("hero.verified")}
                </span>
              ) : null}
            </p>
            <h1
              id="link-name"
              className="animate-rise font-display text-[clamp(2.25rem,9vw,3.75rem)] leading-[0.95] font-semibold tracking-[-0.03em] text-balance break-words text-text-primary"
            >
              {displayName}
            </h1>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-md text-text-secondary">
              <span className="inline-flex items-center gap-1 text-text-primary">
                {rating.count > 0 ? (
                  <Star
                    aria-hidden
                    className="size-4 fill-gold-400 text-gold-400"
                  />
                ) : null}
                {ratingLabel}
              </span>
              {priceLabel ? (
                <span className="font-semibold! tabular-nums text-text-primary">
                  {priceLabel}
                </span>
              ) : null}
              {heroFacts.map((fact) => (
                <span key={fact}>{fact}</span>
              ))}
            </p>
            {description ? (
              <p className="line-clamp-4 max-w-[600px] text-body-md whitespace-pre-line text-text-secondary">
                {description}
              </p>
            ) : null}
            {isOwnProfile ? null : (
              <div
                id="link-hero-cta"
                className="mt-2 flex flex-col gap-2 sm:flex-row"
              >
                <Button
                  variant="accent"
                  size="lg"
                  className="sm:flex-1"
                  onClick={() => scrollToSection("calendar")}
                >
                  <CalendarDays className="size-4" />
                  {t("hero.seeCalendar")}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="sm:flex-1"
                  nativeButton={false}
                  render={<Link href={messageHref} />}
                >
                  <MessageCircle className="size-4" />
                  {t("hero.message")}
                </Button>
              </div>
            )}
          </div>

          {photos.length > 0 ? (
            <div className="mt-8 flex flex-col gap-3">
              <h2 className="text-meta font-semibold! tracking-[0.14em] text-text-tertiary uppercase">
                {t("hero.workTitle")}
              </h2>
              <ul className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
                {photos.map((photo, index) => (
                  <li
                    key={photo.id}
                    className="w-[40%] shrink-0 snap-start sm:w-[24%]"
                  >
                    <Link
                      href={`${profileHref}#portfolio`}
                      data-viewfinder
                      className="focus-ring relative block"
                    >
                      <FgImage
                        src={photo.url}
                        alt={t("hero.photoAlt", {
                          album: photo.albumTitle,
                          name: displayName,
                        })}
                        ratio="3/4"
                        rounded="md"
                        revealIndex={index}
                        sizes="(min-width: 640px) 180px, 40vw"
                      />
                      <span aria-hidden className="viewfinder" />
                    </Link>
                  </li>
                ))}
                <li className="w-[40%] shrink-0 snap-start sm:w-[24%]">
                  <Link
                    href={`${profileHref}#portfolio`}
                    className="focus-ring flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-[var(--fg-radius-md)] border border-dashed border-border-strong p-3 text-center text-body-sm font-semibold! text-text-primary hover:bg-bg-sunken"
                  >
                    {t("hero.allWork")}
                    <ArrowRight aria-hidden className="size-4" />
                  </Link>
                </li>
              </ul>
            </div>
          ) : null}
        </section>

        <SectionNav
          items={steps}
          offset={0}
          topClassName="top-0"
          label={t("nav.label")}
          className="-mx-4 sm:-mx-6 [&_ul]:px-4 sm:[&_ul]:px-6"
        />

        <Step
          id="reviews"
          first
          index={1}
          total={total}
          title={t("steps.reviews.title")}
          intro={t("steps.reviews.intro")}
        >
          <LinkReviews
            reviews={props.reviews}
            rating={rating}
            callName={callName}
            joinedAt={props.joinedAt}
            allHref={`${profileHref}#reviews`}
          />
        </Step>

        <Step
          id="prices"
          index={2}
          total={total}
          title={t("steps.prices.title")}
          intro={
            services.length > 0
              ? t("steps.prices.intro", { name: callName })
              : undefined
          }
        >
          <LinkPackages
            services={services}
            selectedId={selectedServiceId}
            onSelect={onPickService}
            callName={callName}
            askHref={messageHref}
            readOnly={isOwnProfile}
          />
        </Step>

        <Step
          id="terms"
          index={3}
          total={total}
          title={t("steps.terms.title")}
          intro={t("steps.terms.intro")}
        >
          <LinkTerms
            service={selectedService ?? services[0] ?? null}
            callName={callName}
            isVerified={isVerified}
            verifiedAt={props.verifiedAt}
            phoneVerified={props.phoneVerified}
            response={response}
            policies={props.policies}
            area={props.area}
            minNoticeHours={props.minNoticeHours}
          />
        </Step>

        <Step
          id="calendar"
          index={4}
          total={total}
          title={t("steps.calendar.title")}
          intro={t("steps.calendar.intro", { name: callName })}
        >
          <LinkCalendar
            providerId={providerId}
            callName={callName}
            services={services}
            selectedServiceId={selectedServiceId}
            onServiceChange={(id) => {
              setSelectedServiceId(id);
              setTime(null);
            }}
            date={date}
            time={time}
            onDateChange={setDate}
            onTimeChange={setTime}
            sunPoint={props.sunPoint}
            acceptingBookings={acceptingBookings}
            isOwnProfile={isOwnProfile}
            bookHref={bookHref}
            askHref={messageHref}
          />
        </Step>

        <Step
          id="contact"
          index={5}
          total={total}
          title={t("steps.contact.title", { name: callName })}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-surface p-5">
              <MessageCircle
                aria-hidden
                className="size-6 text-text-tertiary"
              />
              <h3 className="text-heading-sm text-text-primary">
                {t("contact.messageTitle")}
              </h3>
              <p className="text-body-sm text-text-secondary">
                {response
                  ? t("contact.messageBodyResponse", {
                      name: callName,
                      time: t(`hero.response.${response.unit}`, {
                        count: response.value,
                      }),
                    })
                  : t("contact.messageBody", { name: callName })}
              </p>
              {isOwnProfile ? (
                <Button
                  variant="outline"
                  size="lg"
                  className="mt-auto w-full"
                  disabled
                >
                  {t("contact.messageAction")}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="lg"
                  className="mt-auto w-full"
                  nativeButton={false}
                  render={<Link href={messageHref} />}
                >
                  {t("contact.messageAction")}
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-3 rounded-[var(--fg-radius-lg)] border border-gold-600 bg-bg-surface p-5 dark:border-gold-400">
              <CalendarDays
                aria-hidden
                className="size-6 text-gold-700 dark:text-gold-400"
              />
              <h3 className="text-heading-sm text-text-primary">
                {t("contact.bookTitle")}
              </h3>
              <p className="text-body-sm text-text-secondary">
                {t("contact.bookBody", { name: callName })}
              </p>
              {acceptingBookings && !isOwnProfile ? (
                <Button
                  variant="accent"
                  size="lg"
                  className="mt-auto w-full"
                  nativeButton={false}
                  render={<Link href={bookHref} />}
                >
                  {date && time
                    ? t("contact.bookWithPick")
                    : t("contact.bookAction")}
                </Button>
              ) : (
                <Button
                  variant="accent"
                  size="lg"
                  className="mt-auto w-full"
                  disabled
                >
                  {acceptingBookings
                    ? t("contact.bookAction")
                    : t("contact.paused")}
                </Button>
              )}
            </div>
          </div>
          {!signedIn && !isOwnProfile ? (
            <p className="mt-4 text-meta text-text-tertiary">
              {t("contact.signInNote")}
            </p>
          ) : null}
        </Step>

        <footer className="flex flex-col items-start gap-2 border-t border-border-subtle pt-6 text-meta text-text-tertiary">
          <p>{t("footer.about", { name: displayName })}</p>
          <Link
            href={profileHref}
            className="focus-ring font-semibold! text-text-secondary underline underline-offset-4 hover:text-text-primary"
          >
            {t("footer.fullProfile")}
          </Link>
        </footer>
      </div>

      {isOwnProfile ? null : (
        <StickyActionBar
          label={t("sticky.label")}
          visible={heroCtaGone && !contactInView}
          title={priceLabel ?? displayName}
          subtitle={ratingLabel}
          secondary={
            <Button
              variant="outline"
              size="icon"
              aria-label={t("hero.message")}
              nativeButton={false}
              render={<Link href={messageHref} />}
            >
              <MessageCircle className="size-4" />
            </Button>
          }
          primary={
            date && time && acceptingBookings ? (
              <Button
                variant="accent"
                className="min-w-32"
                nativeButton={false}
                render={<Link href={bookHref} />}
              >
                {t("sticky.book")}
              </Button>
            ) : (
              <Button
                variant="accent"
                className="min-w-32"
                onClick={() => scrollToSection("calendar")}
              >
                <CalendarDays className="size-4" />
                {t("sticky.pickDate")}
              </Button>
            )
          }
        />
      )}
    </div>
  );
}
