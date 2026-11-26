import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import {
  bookingWordingFor,
  usesDaylight,
} from "@/lib/constants/booking-wording";
import { db } from "@/lib/db";
import { formatAdministrativeLocation } from "@/lib/location";
import { responseBucket } from "@/lib/response-time";
import { listProvinces } from "@/services/geography";
import { publicStudioAddress } from "@/lib/privacy/profile-privacy";
import { getProfileStats } from "@/services/profile-stats";
import {
  getProfileReviewStats,
  getProviderForBooking,
} from "@/services/public-profile";
import { resolvePartyName } from "@/lib/party-name";

import { BookingWizard } from "./booking-wizard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("publicPages.booking");
  return { title: t("pageTitle") };
}

export default async function BookingFlowPage({
  params,
  searchParams,
}: {
  params: Promise<{ providerId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("publicPages.booking");
  const { providerId } = await params;

  const session = await auth();
  if (!session?.user) {
    // Keep the prefill context (e.g. from Fmap) across the login bounce —
    // only known keys, so the callback URL can't be used to smuggle others.
    const incoming = await searchParams;
    const query = new URLSearchParams();
    for (const key of [
      "service",
      "date",
      "time",
      "end",
      "category",
      "source",
    ]) {
      const value = incoming[key];
      if (typeof value === "string") query.set(key, value);
    }
    const callbackPath =
      query.size > 0
        ? `/booking/${providerId}?${query}`
        : `/booking/${providerId}`;
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackPath)}`);
  }

  // A provider can't book themselves — createBooking() already rejects
  // this server-side ("You can't book yourself"), but without this guard
  // a provider could still click through the whole multi-step wizard
  // (pick a service, date, time, fill in contact details) only to have
  // the final submit fail. Bouncing here, before any of that renders, is
  // the same principle as the AUTH_ONLY_PREFIXES redirect in proxy.ts —
  // don't let someone reach a flow that can never succeed for them.
  if (session.user.id === providerId) {
    redirect("/dashboard");
  }

  const [provider, customer, provinces] = await Promise.all([
    getProviderForBooking(providerId),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { phone: true },
    }),
    listProvinces(),
  ]);
  if (!provider) {
    notFound();
  }

  const services = provider.profiles.flatMap((profile) =>
    profile.services.map((service) => ({
      id: service.id,
      kind: service.kind,
      name: service.name,
      description: service.description,
      price: service.price,
      currency: service.currency,
      duration: service.duration,
      editedPhotoCount: service.editedPhotoCount,
      deliveryDays: service.deliveryDays,
    })),
  );

  // The booking summary's provider line and the golden-hour hints
  // (redesign 09/2026). Coordinates are rounded to one decimal (~10 km)
  // here, on the server: enough for sunrise maths, too coarse to locate
  // anyone, and the exact point never reaches the browser.
  const [reviewStats, stats] = await Promise.all([
    getProfileReviewStats(provider.id),
    getProfileStats(provider.id),
  ]);
  // Golden-hour hints only where daylight matters: not for a make-up
  // appointment or a studio room.
  const located = provider.profiles.find(
    (profile) =>
      usesDaylight(profile.role) &&
      profile.latitude != null &&
      profile.longitude != null,
  );
  const mainProfile = provider.profiles[0];
  const sunPoint = located
    ? {
        latitude: Math.round(located.latitude! * 10) / 10,
        longitude: Math.round(located.longitude! * 10) / 10,
      }
    : null;
  const response =
    stats.responseMinutes !== null
      ? responseBucket(stats.responseMinutes)
      : null;
  const tProfile = await getTranslations("publicPages.profile");

  const isModel = provider.profiles.some((profile) => profile.role === "MODEL");

  // Crew-hire (Prompt B7, VIỆC 1) — only offered when the requester holds
  // PHOTOGRAPHER/VIDEOGRAPHER and is booking someone who offers MUA/
  // Model/Studio, matching BOOKABLE_ROLES_BY_ROLE's "who can book whom"
  // table for those two roles.
  const CREW_HIRE_REQUESTER_ROLES = ["PHOTOGRAPHER", "VIDEOGRAPHER"] as const;
  const CREW_HIRE_RECIPIENT_ROLES = [
    "MAKEUP_ARTIST",
    "MODEL",
    "STUDIO",
  ] as const;
  const requesterCrewRole = session.user.roles.find((role) =>
    (CREW_HIRE_REQUESTER_ROLES as readonly string[]).includes(role),
  );
  const canCrewHire =
    Boolean(requesterCrewRole) &&
    provider.profiles.some((profile) =>
      (CREW_HIRE_RECIPIENT_ROLES as readonly string[]).includes(profile.role),
    );

  return (
    <BookingWizard
      providerId={provider.id}
      providerName={resolvePartyName(provider, t("fallbackProviderName"))}
      providerAvatar={provider.avatar}
      providerUsername={provider.username}
      providerRating={reviewStats.count > 0 ? reviewStats.avgRating : null}
      providerReviewCount={reviewStats.count}
      providerVerified={provider.roles.some(
        (role) => role.verificationStatus === "VERIFIED",
      )}
      responseNote={
        response
          ? tProfile(`responseShort.${response.unit}`, {
              count: response.value,
            })
          : t("flow.confirmWithin48h")
      }
      sunPoint={sunPoint}
      providerPhotos={provider.profiles
        .flatMap((profile) => profile.media.map((media) => media.url))
        .slice(0, 6)}
      services={services}
      contactPhoneDefault={customer?.phone ?? ""}
      isModel={isModel}
      provinces={provinces}
      kind={bookingWordingFor(mainProfile?.role)}
      policies={{
        depositPercent: mainProfile?.depositPercent ?? null,
        depositPolicy: mainProfile?.depositPolicy ?? null,
        cancellationPolicy: mainProfile?.cancellationPolicy ?? null,
        reschedulePolicy: mainProfile?.reschedulePolicy ?? null,
      }}
      venuePlace={
        provider.profiles
          .filter((profile) => profile.role === "STUDIO")
          .map((profile) =>
            [
              publicStudioAddress(profile),
              formatAdministrativeLocation(profile),
            ]
              .filter(Boolean)
              .join(", "),
          )
          .find(Boolean) ?? null
      }
      venueAddressShown={provider.profiles.some(
        (profile) => publicStudioAddress(profile) !== null,
      )}
      requesterCrewRole={canCrewHire ? (requesterCrewRole ?? null) : null}
    />
  );
}
