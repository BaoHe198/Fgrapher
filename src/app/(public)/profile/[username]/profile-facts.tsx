"use client";

import { BadgeCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { ResponseBucket } from "@/lib/response-time";

export interface ProfileFactsProps {
  identityVerifiedAt: string | null;
  phoneVerified: boolean;
  joinedAt: string;
  response: ResponseBucket | null;
  depositPercent: number | null;
  depositPolicy: string | null;
  cancellationPolicy: string | null;
  reschedulePolicy: string | null;
}

const monthYear = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

// "Thông tin xác minh" beside the booking terms (redesign 09/2026). What
// the platform checked - identity, phone - and when; what the provider
// says about deposit, cancelling and rescheduling. The deposit line always
// ends with the platform's own position: agreed and paid directly, never
// collected online (CLAUDE.md, no online payment in this MVP).
export function ProfileFacts({
  identityVerifiedAt,
  phoneVerified,
  joinedAt,
  response,
  depositPercent,
  depositPolicy,
  cancellationPolicy,
  reschedulePolicy,
}: ProfileFactsProps) {
  const t = useTranslations("publicPages.profile.facts");

  const rows = [
    {
      label: t("identity"),
      value: identityVerifiedAt
        ? t("verifiedOn", { date: monthYear(identityVerifiedAt) })
        : t("notVerified"),
      good: Boolean(identityVerifiedAt),
    },
    {
      label: t("phone"),
      value: phoneVerified ? t("verified") : t("notVerified"),
      good: phoneVerified,
    },
    { label: t("joined"), value: monthYear(joinedAt), good: false },
    ...(response
      ? [
          {
            label: t("responseTime"),
            value: t(`response.${response.unit}`, { count: response.value }),
            good: false,
          },
        ]
      : []),
  ];

  const deposit =
    depositPercent != null || depositPolicy
      ? [
          depositPercent != null
            ? t("depositPercent", { percent: depositPercent })
            : null,
          depositPolicy,
          t("depositDirect"),
        ]
          .filter(Boolean)
          .join(" ")
      : t("depositDefault");

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="flex flex-col gap-3 rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-surface p-5">
        <h3 className="text-heading-sm text-text-primary">{t("title")}</h3>
        <dl className="flex flex-col gap-3">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-4 text-body-sm"
            >
              <dt className="text-text-secondary">{row.label}</dt>
              <dd
                className={
                  row.good
                    ? "flex items-center gap-1 font-semibold! text-success"
                    : "font-semibold! text-text-primary"
                }
              >
                {row.good ? (
                  <BadgeCheck aria-hidden className="size-3.5" />
                ) : null}
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <Accordion
        multiple
        defaultValue={["deposit"]}
        className="rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-surface px-5"
      >
        <AccordionItem value="deposit">
          <AccordionTrigger>{t("deposit")}</AccordionTrigger>
          <AccordionPanel>
            <p className="text-body-sm text-text-secondary">{deposit}</p>
          </AccordionPanel>
        </AccordionItem>
        <AccordionItem value="cancel">
          <AccordionTrigger>{t("cancellation")}</AccordionTrigger>
          <AccordionPanel>
            <p className="text-body-sm whitespace-pre-line text-text-secondary">
              {cancellationPolicy ?? t("policyAskInChat")}
            </p>
          </AccordionPanel>
        </AccordionItem>
        <AccordionItem value="reschedule">
          <AccordionTrigger>{t("reschedule")}</AccordionTrigger>
          <AccordionPanel>
            <p className="text-body-sm whitespace-pre-line text-text-secondary">
              {reschedulePolicy ?? t("policyAskInChat")}
            </p>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
