"use client";

import type { Role } from "@prisma/client";
import {
  BadgeCheck,
  Briefcase,
  CalendarClock,
  CalendarX,
  Camera,
  Clock,
  HandCoins,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FgImage } from "@/components/ui/fg-image";
import { formatDate } from "@/lib/format";
import type { ResponseBucket } from "@/lib/response-time";
import { cn, formatCurrency } from "@/lib/utils";

import { ReviewsTab } from "./reviews-tab";

const monthYear = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

/** A section of the profile's right column, Airbnb-style: a rule, then a heading. */
export function ProfileSection({
  id,
  title,
  children,
  className,
}: {
  id: string;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={title ? `${id}-title` : undefined}
      className={cn(
        "scroll-mt-24 border-t border-border-subtle py-10 first:border-t-0 first:pt-0",
        className,
      )}
    >
      {title ? (
        <h2
          id={`${id}-title`}
          className="mb-6 text-display-md text-balance text-text-primary"
        >
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

export interface PackageItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  editedPhotoCount?: number | null;
  deliveryDays?: number | null;
  /** The provider's own choice of picture; else one is taken by position. */
  photoUrl?: string | null;
}

// The packages as Airbnb lists a host's offerings: a photo, the name, two
// lines of what it is, then the price and what it delivers. The whole card
// opens the schedule with this package in view.
export function PackageList({
  services,
  photos,
  onPick,
  readOnly,
}: {
  services: PackageItem[];
  photos: string[];
  onPick: (serviceId: string) => void;
  readOnly: boolean;
}) {
  const t = useTranslations("profilePage.packages");
  return (
    <ul className="flex flex-col gap-4">
      {services.map((service, index) => {
        const photo =
          service.photoUrl ??
          (photos.length > 0 ? photos[index % photos.length] : null);
        const facts = [
          service.price === 0
            ? t("tfp")
            : t("price", {
                price: formatCurrency(service.price, service.currency),
              }),
          service.editedPhotoCount != null
            ? t("photos", { count: service.editedPhotoCount })
            : null,
          service.deliveryDays != null
            ? t("delivery", { count: service.deliveryDays })
            : null,
        ].filter(Boolean);
        const body = (
          <>
            {photo ? (
              <FgImage
                src={photo}
                alt=""
                ratio="1/1"
                rounded="lg"
                revealIndex={index}
                sizes="140px"
                className="w-28 shrink-0 sm:w-36"
                imageClassName="transition-transform duration-[var(--fg-dur-400)] ease-fg-out group-hover/pkg:scale-[1.04]"
              />
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-1 text-left">
              <span className="line-clamp-2 text-heading-sm text-text-primary">
                {service.name}
              </span>
              {service.description ? (
                <span className="line-clamp-2 text-body-sm text-text-secondary">
                  {service.description}
                </span>
              ) : null}
              <span className="mt-auto text-body-sm text-text-secondary">
                <span className="font-semibold! text-text-primary">
                  {facts[0]}
                </span>
                {facts.slice(1).map((fact) => ` · ${fact}`)}
              </span>
            </div>
          </>
        );
        const cardClass =
          "group/pkg flex w-full gap-4 rounded-[var(--fg-radius-xl)] border border-border-subtle bg-bg-surface p-3 shadow-[var(--shadow-sm)] transition-[box-shadow,transform] duration-[var(--fg-dur-260)] ease-fg-out";
        return (
          <li key={service.id}>
            {readOnly ? (
              <div className={cardClass}>{body}</div>
            ) : (
              <button
                type="button"
                onClick={() => onPick(service.id)}
                className={cn(
                  cardClass,
                  "focus-ring cursor-pointer hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] motion-reduce:hover:translate-y-0",
                )}
              >
                {body}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export interface ReviewItem {
  id: string;
  rating: number;
  content: string | null;
  response: string | null;
  createdAt: string;
  reviewer: {
    name: string | null;
    firstName: string | null;
    avatar: string | null;
  };
}

function Stars({ value }: { value: number }) {
  return (
    <span aria-hidden className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "size-3",
            n <= Math.round(value)
              ? "fill-text-primary text-text-primary"
              : "text-border-strong",
          )}
        />
      ))}
    </span>
  );
}

// Reviews as Airbnb shows them: the score and count as the heading, six
// reviews in two columns, and "Xem tất cả" opening the full list (with its
// sorting, filters, replies and reporting) in a dialog.
export function ReviewsSummary({
  providerId,
  providerName,
  callName,
  joinedAt,
  reviews,
  stats,
}: {
  providerId: string;
  providerName: string;
  callName: string;
  joinedAt: string;
  reviews: ReviewItem[];
  stats: {
    avgRating: number;
    count: number;
    breakdown: { stars: number; count: number; percent: number }[];
  };
}) {
  const t = useTranslations("profilePage.reviews");
  const [allOpen, setAllOpen] = useState(false);

  if (stats.count === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-[var(--fg-radius-xl)] border border-dashed border-border-strong p-6">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-gold-50 px-3 py-1 text-meta font-semibold! text-gold-700 dark:bg-gold-900/40 dark:text-gold-200">
          <Sparkles aria-hidden className="size-3.5" />
          {t("newBadge", { date: monthYear(joinedAt) })}
        </span>
        <p className="text-body-md text-text-primary">
          {t("emptyTitle", { name: callName })}
        </p>
        <p className="text-body-sm text-text-secondary">{t("emptyBody")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <ul className="grid gap-x-12 gap-y-8 md:grid-cols-2">
        {reviews.slice(0, 6).map((review) => {
          const name =
            review.reviewer.firstName ?? review.reviewer.name ?? t("anonymous");
          return (
            <li key={review.id} className="flex flex-col gap-2.5">
              <div className="flex items-center gap-3">
                <Avatar className="size-11">
                  {review.reviewer.avatar ? (
                    <AvatarImage src={review.reviewer.avatar} alt="" />
                  ) : null}
                  <AvatarFallback>
                    {name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-body-md font-semibold! text-text-primary">
                  {name}
                </span>
              </div>
              <span className="flex items-center gap-2 text-meta text-text-secondary">
                <Stars value={review.rating} />
                <span className="sr-only">
                  {t("starsLabel", { count: review.rating })}
                </span>
                · {formatDate(review.createdAt)}
              </span>
              {review.content ? (
                <p className="line-clamp-5 text-body-md whitespace-pre-line [overflow-wrap:anywhere] text-text-primary">
                  {review.content}
                </p>
              ) : null}
              {review.response ? (
                <p className="border-l-2 border-border-default pl-3 text-body-sm text-text-secondary">
                  <span className="font-semibold! text-text-primary">
                    {t("responseFrom", { name: callName })}:{" "}
                  </span>
                  {review.response}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      <Button
        variant="secondary"
        size="lg"
        className="w-full"
        onClick={() => setAllOpen(true)}
      >
        {t("seeAll", { count: stats.count })}
      </Button>
      <Dialog open={allOpen} onOpenChange={setAllOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-display-sm">
              <Star aria-hidden className="size-6 fill-current" />
              {t("heading", {
                rating: stats.avgRating.toFixed(2).replace(".", ","),
                count: stats.count,
              })}
            </DialogTitle>
          </DialogHeader>
          <ReviewsTab
            providerId={providerId}
            providerName={providerName}
            reviews={reviews}
            stats={stats}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// "Về {tên}" - Airbnb's "My qualifications": the person on a card, and
// beside it the facts that make them worth booking. Each line appears only
// when there is something true to say.
export function AboutProvider({
  displayName,
  roleLabel,
  role,
  avatar,
  facts,
  modelDetails,
}: {
  displayName: string;
  roleLabel: string;
  role: Role;
  avatar: string | null;
  facts: {
    yearsExperience: number | null;
    completedShoots: number;
    response: ResponseBucket | null;
    identityVerifiedAt: string | null;
    phoneVerified: boolean;
    joinedAt: string;
    offersTfp: boolean;
  };
  modelDetails: { label: string; value: string }[];
}) {
  const t = useTranslations("profilePage.about");
  // A studio has years in business and rentals, a videographer has films:
  // "năm kinh nghiệm" and "buổi đã chụp" are a photographer's words.
  const shootsKey =
    role === "STUDIO"
      ? "shootsStudio"
      : role === "VIDEOGRAPHER"
        ? "shootsFilm"
        : "shoots";
  const rows: { icon: LucideIcon; title: string; body?: string }[] = [
    ...(facts.yearsExperience
      ? [
          {
            icon: Briefcase,
            title: t(role === "STUDIO" ? "yearsStudio" : "years", {
              count: facts.yearsExperience,
            }),
          },
        ]
      : []),
    ...(facts.completedShoots > 0
      ? [
          {
            icon: Camera,
            title: t(shootsKey, { count: facts.completedShoots }),
            body: t(role === "STUDIO" ? "shootsBodyStudio" : "shootsBody"),
          },
        ]
      : []),
    ...(facts.identityVerifiedAt
      ? [
          {
            icon: BadgeCheck,
            title: t("verified"),
            body: t("verifiedBody", {
              date: monthYear(facts.identityVerifiedAt),
            }),
          },
        ]
      : []),
    ...(facts.phoneVerified ? [{ icon: Phone, title: t("phone") }] : []),
    ...(facts.response
      ? [
          {
            icon: MessageCircle,
            title: t(`response.${facts.response.unit}`, {
              count: facts.response.value,
            }),
          },
        ]
      : []),
    ...(facts.offersTfp ? [{ icon: Sparkles, title: t("tfp") }] : []),
    {
      icon: UserRound,
      title: t("joined", { date: monthYear(facts.joinedAt) }),
    },
  ];

  return (
    <div className="grid items-start gap-8 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
      <div className="flex flex-col items-center gap-2 rounded-[var(--fg-radius-xl)] bg-bg-surface p-6 text-center shadow-[var(--shadow-md)]">
        <Avatar className="size-24">
          {avatar ? <AvatarImage src={avatar} alt="" /> : null}
          <AvatarFallback className="text-display-sm">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="text-heading-lg text-text-primary">{displayName}</span>
        <span className="text-meta text-text-secondary">{roleLabel}</span>
      </div>
      <div className="flex flex-col gap-6">
        <ul className="flex flex-col gap-5">
          {rows.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-4">
              <Icon
                aria-hidden
                className="mt-0.5 size-6 shrink-0 text-text-primary"
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-body-md font-semibold! text-text-primary">
                  {title}
                </span>
                {body ? (
                  <span className="text-body-sm text-text-secondary">
                    {body}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        {modelDetails.length > 0 ? (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-[var(--fg-radius-lg)] bg-bg-sunken p-4 sm:grid-cols-3">
            {modelDetails.map((detail) => (
              <div key={detail.label} className="flex flex-col gap-0.5">
                <dt className="text-meta tracking-[0.08em] text-text-tertiary uppercase">
                  {detail.label}
                </dt>
                <dd className="text-body-md font-semibold! text-text-primary">
                  {detail.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </div>
  );
}

// "Những điều cần biết" - Airbnb's "Things to know", holding what the link
// page called "Yêu cầu & quyền lợi": deposit, cancelling, rescheduling,
// notice, the 48-hour confirmation, and keeping a deposit safe. Each line is
// the provider's own words or a rule the platform enforces; nothing promises
// a refund, because the deposit is paid to the provider directly.
export function ThingsToKnow({
  callName,
  policies,
  minNoticeHours,
}: {
  callName: string;
  policies: {
    depositPercent: number | null;
    depositPolicy: string | null;
    cancellationPolicy: string | null;
    reschedulePolicy: string | null;
  };
  minNoticeHours: number;
}) {
  const t = useTranslations("profilePage.know");
  const ask = t("askInChat", { name: callName });
  const deposit =
    policies.depositPercent != null || policies.depositPolicy
      ? [
          policies.depositPercent != null
            ? t("depositPercent", { percent: policies.depositPercent })
            : null,
          policies.depositPolicy,
          t("depositDirect", { name: callName }),
        ]
          .filter(Boolean)
          .join(" ")
      : t("depositAsk", { name: callName });

  const items: {
    icon: LucideIcon;
    title: string;
    body: string;
    muted?: boolean;
  }[] = [
    { icon: HandCoins, title: t("deposit"), body: deposit },
    {
      icon: CalendarX,
      title: t("cancel"),
      body: policies.cancellationPolicy ?? ask,
      muted: !policies.cancellationPolicy,
    },
    {
      icon: CalendarClock,
      title: t("reschedule"),
      body: policies.reschedulePolicy ?? ask,
      muted: !policies.reschedulePolicy,
    },
    {
      icon: Clock,
      title: t("notice"),
      body: t("noticeBody", { hours: minNoticeHours }),
    },
    {
      icon: BadgeCheck,
      title: t("confirm"),
      body: t("confirmBody", { name: callName }),
    },
    {
      icon: ShieldCheck,
      title: t("safety"),
      body: t("safetyBody", { name: callName }),
    },
  ];

  return (
    <ul className="grid gap-x-12 gap-y-7 md:grid-cols-2">
      {items.map(({ icon: Icon, title, body, muted }) => (
        <li key={title} className="flex flex-col gap-2">
          <Icon aria-hidden className="size-6 text-text-primary" />
          <span className="text-body-md font-semibold! text-text-primary">
            {title}
          </span>
          <span
            className={cn(
              "text-body-sm whitespace-pre-line [overflow-wrap:anywhere]",
              muted ? "text-text-tertiary italic" : "text-text-secondary",
            )}
          >
            {body}
          </span>
        </li>
      ))}
    </ul>
  );
}
