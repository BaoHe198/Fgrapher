import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { placeToFormValues } from "@/components/places/form-values";
import { PlaceForm } from "@/components/places/place-form";
import { auth } from "@/lib/auth";
import { placeHref } from "@/lib/places";
import { db } from "@/lib/db";
import { listProvinces } from "@/services/geography";
import { getMyPlaceForEdit } from "@/services/places";

export async function generateMetadata() {
  const t = await getTranslations("places.form");
  return { title: t("editTitle") };
}

/** The proposer edits a spot that is waiting, or re-sends one sent back. */
export default async function EditPlacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;
  const place = await getMyPlaceForEdit(session.user.id, id);
  if (!place) notFound();
  // Approved: the spot is public and the admins' to edit now.
  if (place.reviewStatus === "APPROVED") {
    const province = await db.province.findUniqueOrThrow({
      where: { id: place.provinceId },
      select: { code: true },
    });
    redirect(placeHref({ slug: place.slug, province }));
  }
  const [provinces, t] = await Promise.all([
    listProvinces(),
    getTranslations("places.form"),
  ]);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-display-md text-text-primary">{t("editTitle")}</h1>
      {place.reviewStatus === "REJECTED" && place.moderationNote ? (
        <p
          role="note"
          className="rounded-[var(--fg-radius-md)] bg-danger-bg p-3 text-body-sm text-danger"
        >
          {t("rejectedBanner", { note: place.moderationNote })}
        </p>
      ) : null}
      <PlaceForm
        mode="edit"
        placeId={place.id}
        initial={placeToFormValues(place)}
        existingPhotos={place.media}
        provinces={provinces}
        doneHref="/dashboard/places"
      />
    </div>
  );
}
