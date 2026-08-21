import type { Metadata } from "next";

import { rolePricesVnd } from "@/lib/constants/plans";

import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Create your account — Fgrapher",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ interval?: string }>;
}) {
  const { interval: intervalParam } = await searchParams;
  const interval = intervalParam === "year" ? "year" : "month";

  // Role checkboxes always show the monthly rate — the chosen interval only
  // affects what's actually charged, confirmed on the onboarding/billing
  // screen right before checkout.
  return <RegisterForm rolePrices={rolePricesVnd("month")} interval={interval} />;
}
