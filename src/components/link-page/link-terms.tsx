"use client";

import {
  BadgeCheck,
  CalendarClock,
  CalendarX,
  Check,
  Clock,
  HandCoins,
  MapPin,
  MessageCircle,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import type { ResponseBucket } from "@/lib/response-time";

import type { LinkService } from "./link-packages";

interface LinkTermsProps {
  /** The package picked above, or the first one; null when there are none. */
  service: LinkService | null;
  callName: string;
  isVerified: boolean;
  verifiedAt: string | null;
  phoneVerified: boolean;
  response: ResponseBucket | null;
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
  minNoticeHours: number;
}

const monthYear = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

// Step 3: "Yêu cầu & quyền lợi". Two lists the customer reads before money
// changes hands: what they get - from the package and from booking through
// Fgrapher - and what is asked of them: deposit, cancelling, rescheduling,
// notice, how long the provider has to confirm.
//
// Every line is either the provider's own words or a rule the platform
// actually enforces. Nothing here promises a refund: the deposit is paid to
// the provider directly and Fgrapher never holds it, so the page says so.
export function LinkTerms({
  service,
  callName,
  isVerified,
  verifiedAt,
  phoneVerified,
  response,
  policies,
  area,
  minNoticeHours,
}: LinkTermsProps) {
  const t = useTranslations("linkPage.terms");

  const gets = [
    service && service.editedPhotoCount != null
      ? t("get.photos", { count: service.editedPhotoCount })
      : null,
    service && service.deliveryDays != null
      ? t("get.delivery", { count: service.deliveryDays })
      : null,
    isVerified
      ? verifiedAt
        ? t("get.verifiedOn", { name: callName, date: monthYear(verifiedAt) })
        : t("get.verified", { name: callName })
      : null,
    phoneVerified ? t("get.phone") : null,
    t("get.moderated"),
    t("get.record"),
    t("get.review"),
    t("get.free"),
  ].filter(Boolean) as string[];

  const deposit =
    policies.depositPercent != null || policies.depositPolicy
      ? [
          policies.depositPercent != null
            ? t("need.depositPercent", { percent: policies.depositPercent })
            : null,
          policies.depositPolicy,
          t("need.depositDirect", { name: callName }),
        ]
          .filter(Boolean)
          .join(" ")
      : t("need.depositAsk", { name: callName });

  const areaText = area.nationwide
    ? t("need.areaNationwide")
    : area.radiusKm && area.location
      ? t("need.areaRadius", { km: area.radiusKm, place: area.location })
      : area.location;

  const needs: {
    key: string;
    icon: LucideIcon;
    label: string;
    value: string;
    /** The provider wrote nothing; the value is our "ask in chat" line. */
    missing?: boolean;
  }[] = [
    {
      key: "deposit",
      icon: HandCoins,
      label: t("need.deposit"),
      value: deposit,
    },
    {
      key: "cancel",
      icon: CalendarX,
      label: t("need.cancel"),
      value:
        policies.cancellationPolicy ?? t("need.askInChat", { name: callName }),
      missing: !policies.cancellationPolicy,
    },
    {
      key: "reschedule",
      icon: CalendarClock,
      label: t("need.reschedule"),
      value:
        policies.reschedulePolicy ?? t("need.askInChat", { name: callName }),
      missing: !policies.reschedulePolicy,
    },
    {
      key: "notice",
      icon: Clock,
      label: t("need.notice"),
      value: t("need.noticeValue", { hours: minNoticeHours }),
    },
    {
      key: "confirm",
      icon: BadgeCheck,
      label: t("need.confirm"),
      value: t("need.confirmValue", { name: callName }),
    },
    ...(response
      ? [
          {
            key: "response",
            icon: MessageCircle,
            label: t("need.response"),
            value: t(`need.responseValue.${response.unit}`, {
              count: response.value,
            }),
          },
        ]
      : []),
    ...(areaText
      ? [
          {
            key: "area",
            icon: MapPin,
            label: t("need.area"),
            value: areaText,
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-surface p-5">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-heading-sm text-text-primary">
              {t("getTitle")}
            </h3>
            {service ? (
              <span className="text-meta text-text-tertiary">
                {t("getForPackage", { name: service.name })}
              </span>
            ) : null}
          </div>
          <ul className="flex flex-col gap-2.5">
            {gets.map((line) => (
              <li
                key={line}
                className="flex items-start gap-2.5 text-body-sm text-text-primary"
              >
                <Check
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-success"
                />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-4 rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-surface p-5">
          <h3 className="text-heading-sm text-text-primary">
            {t("needTitle")}
          </h3>
          <dl className="flex flex-col gap-3.5">
            {needs.map(({ key, icon: Icon, label, value, missing }) => (
              <div key={key} className="flex items-start gap-2.5">
                <Icon
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-text-tertiary"
                />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <dt className="text-meta font-semibold! tracking-[0.04em] text-text-secondary uppercase">
                    {label}
                  </dt>
                  <dd
                    className={
                      missing
                        ? "text-body-sm text-text-tertiary italic"
                        : "text-body-sm whitespace-pre-line [overflow-wrap:anywhere] text-text-primary"
                    }
                  >
                    {value}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-[var(--fg-radius-lg)] border border-gold-400 bg-gold-50 p-4 dark:border-gold-700 dark:bg-gold-900/30">
        <ShieldCheck
          aria-hidden
          className="mt-0.5 size-5 shrink-0 text-gold-700 dark:text-gold-400"
        />
        <div className="flex flex-col gap-1">
          <p className="text-body-sm font-semibold! text-text-primary">
            {t("safetyTitle")}
          </p>
          <p className="text-body-sm text-text-secondary">
            {t("safetyBody", { name: callName })}
          </p>
        </div>
      </div>
    </div>
  );
}
