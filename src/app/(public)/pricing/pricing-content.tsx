"use client";

import type { Role } from "@prisma/client";
import {
  Building2,
  Camera,
  Check,
  type LucideIcon,
  Sparkles,
  ShoppingBag,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/constants";
import { cn, formatCurrency } from "@/lib/utils";

interface Plan {
  role: Role;
  icon: LucideIcon;
  popular?: boolean;
  description: string;
  features: string[];
}

const PLANS: Plan[] = [
  {
    role: "PHOTOGRAPHER",
    icon: Camera,
    popular: true,
    description: "Wedding, portrait, and event photography.",
    features: [
      "Public profile with portfolio",
      "Unlimited photo uploads",
      "Booking calendar & requests",
      "Client messaging",
      "Reviews & ratings",
      "Search visibility",
      "Analytics dashboard",
    ],
  },
  {
    role: "VIDEOGRAPHER",
    icon: Video,
    description: "Cinematic video and highlight reels.",
    features: [
      "Public profile with portfolio",
      "Unlimited video uploads",
      "Booking calendar & requests",
      "Client messaging",
      "Reviews & ratings",
      "Search visibility",
      "Analytics dashboard",
    ],
  },
  {
    role: "MAKEUP_ARTIST",
    icon: Sparkles,
    description: "Bridal, editorial, and event makeup.",
    features: [
      "Public profile with portfolio",
      "Unlimited portfolio uploads",
      "Booking calendar & requests",
      "Client messaging",
      "Reviews & ratings",
      "Search visibility",
      "Analytics dashboard",
    ],
  },
  {
    role: "STUDIO",
    icon: Building2,
    description: "Rent out your studio space by the hour or day.",
    features: [
      "Studio listing with photos",
      "Hourly & daily rate booking",
      "Amenities showcase",
      "Availability calendar",
      "Client messaging",
      "Reviews & ratings",
    ],
  },
  {
    role: "CAMERA_SHOP",
    icon: ShoppingBag,
    description: "Sell and rent gear to the community.",
    features: [
      "Shop profile",
      "Unlimited product listings",
      "Rental & sale management",
      "Order management",
      "Inventory tracking",
      "Client messaging",
    ],
  },
];

const FAQS = [
  {
    q: "Can I have multiple roles?",
    a: "Yes — one account can hold several paid roles at once (e.g. Photographer + Studio), each billed as its own subscription, all shown together on one profile page.",
  },
  {
    q: "What happens after the free trial?",
    a: "After 14 days your card is charged automatically at the rate you selected. You can cancel anytime before the trial ends and you won't be charged.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancelling keeps your plan active until the end of the current billing period, and all your data is kept if you want to reactivate later.",
  },
  {
    q: "Do you take a commission on bookings?",
    a: "No — Fgrapher charges a flat subscription per role, not a percentage of your bookings.",
  },
  {
    q: "What payment methods do you accept?",
    a: "Credit and debit cards, processed securely through Stripe, plus local Vietnamese payment methods if you enable them in your Stripe settings.",
  },
  {
    q: "Is there a discount for annual billing?",
    a: "Yes — switch to yearly billing on this page and pay 20% less than the monthly rate, charged once a year.",
  },
];

const COMPARISON_FEATURES = [
  "Public profile",
  "Booking calendar",
  "Client messaging",
  "Reviews & ratings",
  "Search visibility",
  "Analytics dashboard",
];

const COMPARISON_MATRIX: Record<Role, boolean[]> = {
  PHOTOGRAPHER: [true, true, true, true, true, true],
  VIDEOGRAPHER: [true, true, true, true, true, true],
  MAKEUP_ARTIST: [true, true, true, true, true, true],
  STUDIO: [true, true, true, true, false, false],
  CAMERA_SHOP: [true, false, true, false, false, false],
  CUSTOMER: [false, false, false, false, false, false],
  ADMIN: [false, false, false, false, false, false],
};

export function PricingContent({
  monthlyPrices,
  yearlyPrices,
}: {
  monthlyPrices: Partial<Record<Role, number>>;
  yearlyPrices: Partial<Record<Role, number>>;
}) {
  const [yearly, setYearly] = useState(false);

  return (
    <div className="flex flex-col">
      <section className="bg-green-900 px-6 py-20 text-center">
        <span className="text-caption-upper tracking-[0.14em] text-gold-300">PRICING</span>
        <h1 className="mt-3 text-display-xl text-gold-50">Plans that grow with your craft</h1>
        <p className="mx-auto mt-3 max-w-[560px] text-body-lg text-green-200">
          One flat subscription per role, billed in VND — no commission on bookings, ever.
        </p>

        <div className="mx-auto mt-6 inline-flex overflow-hidden rounded-full border border-border-subtle bg-bg-surface">
          {(["Monthly", "Yearly"] as const).map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setYearly(label === "Yearly")}
              className={cn(
                "px-4 py-1.5 text-body-sm font-bold transition-colors duration-150",
                yearly === (label === "Yearly")
                  ? "bg-brand-primary text-text-on-brand"
                  : "text-text-secondary",
              )}
            >
              {label}
              {label === "Yearly" ? " (save 20%)" : ""}
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 py-12">
        <Card className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-1">
            <span className="text-heading-lg text-text-primary">Customer — Free forever</span>
            <span className="text-body-md text-text-secondary">
              Browse, book, and buy. No card required.
            </span>
          </div>
          <Button variant="secondary" nativeButton={false} render={<Link href="/register" />}>
            Sign up free
          </Button>
        </Card>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const displayPrice = (yearly ? yearlyPrices : monthlyPrices)[plan.role] ?? 0;

            return (
              <Card
                key={plan.role}
                className={cn(
                  "flex flex-col gap-4",
                  plan.popular && "border-2 border-gold-400",
                )}
              >
                {plan.popular ? (
                  <span className="w-fit rounded-full bg-brand-primary px-2.5 py-1 text-body-sm font-bold text-text-on-brand">
                    Most popular
                  </span>
                ) : null}

                <div className="flex size-12 items-center justify-center rounded-full bg-success-bg">
                  <Icon className="size-5 text-brand-primary" />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-heading-lg text-text-primary">
                    {ROLE_LABELS[plan.role]}
                  </span>
                  <span className="text-display-md text-text-primary">
                    {formatCurrency(displayPrice, "VND")}
                    <span className="text-body-sm font-normal text-text-secondary">
                      /{yearly ? "year" : "month"}
                    </span>
                  </span>
                  <span className="text-body-sm text-text-secondary">{plan.description}</span>
                </div>

                <div className="border-t border-border-subtle pt-4">
                  <ul className="flex flex-col gap-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-body-sm">
                        <Check className="mt-0.5 size-4 shrink-0 text-success" />
                        <span className="text-text-primary">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  variant={plan.popular ? "accent" : "secondary"}
                  className="w-full"
                  nativeButton={false}
                  render={
                    <Link href={`/register?role=${plan.role}${yearly ? "&interval=year" : ""}`} />
                  }
                >
                  Start 14-day trial
                </Button>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 py-12">
        <h2 className="mb-6 text-heading-xl text-text-primary">Compare plans</h2>
        <Card padding={false} className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-body-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="px-5 py-3 text-left text-text-tertiary">Feature</th>
                {PLANS.map((plan) => (
                  <th key={plan.role} className="px-3 py-3 text-center text-text-primary">
                    {ROLE_LABELS[plan.role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_FEATURES.map((feature, i) => (
                <tr key={feature} className="border-b border-border-subtle last:border-b-0">
                  <td className="px-5 py-3 text-text-secondary">{feature}</td>
                  {PLANS.map((plan) => (
                    <td key={plan.role} className="px-3 py-3 text-center">
                      {COMPARISON_MATRIX[plan.role][i] ? (
                        <Check className="mx-auto size-4 text-success" />
                      ) : (
                        <span className="text-text-tertiary">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section className="mx-auto w-full max-w-2xl px-6 py-12">
        <h2 className="mb-4 text-heading-xl text-text-primary">Frequently asked questions</h2>
        <Accordion multiple>
          {FAQS.map((faq) => (
            <AccordionItem key={faq.q} value={faq.q}>
              <AccordionTrigger>{faq.q}</AccordionTrigger>
              <AccordionPanel>
                <p className="pb-4">{faq.a}</p>
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="bg-bg-sunken px-6 py-16 text-center">
        <h2 className="text-heading-xl text-text-primary">Still deciding?</h2>
        <Button
          variant="secondary"
          className="mt-4"
          nativeButton={false}
          render={<Link href="/contact" />}
        >
          Talk to us
        </Button>
      </section>
    </div>
  );
}
