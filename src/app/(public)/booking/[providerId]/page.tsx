import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProviderForBooking } from "@/services/public-profile";

import { BookingWizard } from "./booking-wizard";

export const metadata: Metadata = { title: "Book a session — Fgrapher" };

export default async function BookingFlowPage({
  params,
}: {
  params: Promise<{ providerId: string }>;
}) {
  const { providerId } = await params;

  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=/booking/${providerId}`);
  }

  const [provider, customer] = await Promise.all([
    getProviderForBooking(providerId),
    db.user.findUnique({ where: { id: session.user.id }, select: { phone: true } }),
  ]);
  if (!provider) {
    notFound();
  }

  const services = provider.profiles.flatMap((profile) =>
    profile.services.map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      price: service.price,
      currency: service.currency,
      duration: service.duration,
    })),
  );

  return (
    <BookingWizard
      providerId={provider.id}
      providerName={provider.firstName ?? provider.name ?? "this provider"}
      providerAvatar={provider.avatar}
      services={services}
      contactPhoneDefault={customer?.phone ?? ""}
    />
  );
}
