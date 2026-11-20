import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { EMPTY_PLACE_FORM, PlaceForm } from "@/components/places/place-form";
import { auth } from "@/lib/auth";
import { listProvinces } from "@/services/geography";
import { canProposePlaces } from "@/services/places";

export async function generateMetadata() {
  const t = await getTranslations("places.form");
  return { title: t("newTitle") };
}

export default async function NewPlacePage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/dashboard/places/new");
  // Not verified yet: the list page explains what to do.
  if (!(await canProposePlaces(session.user.id))) redirect("/dashboard/places");
  const [provinces, t] = await Promise.all([
    listProvinces(),
    getTranslations("places.form"),
  ]);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-display-md text-text-primary">{t("newTitle")}</h1>
      <PlaceForm
        mode="propose"
        initial={EMPTY_PLACE_FORM}
        provinces={provinces}
        doneHref="/dashboard/places"
      />
    </div>
  );
}
