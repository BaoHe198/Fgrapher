import { getTranslations } from "next-intl/server";

import { EMPTY_PLACE_FORM, PlaceForm } from "@/components/places/place-form";
import { listProvinces } from "@/services/geography";

export async function generateMetadata() {
  const t = await getTranslations("places.form");
  return { title: t("adminNewTitle") };
}

/**
 * An admin adds a spot (the starter set). It is saved waiting for review,
 * and approved from its own page — publishing stays one deliberate step.
 */
export default async function AdminNewPlacePage() {
  const [provinces, t] = await Promise.all([
    listProvinces(),
    getTranslations("places.form"),
  ]);
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-display-md text-text-primary">
        {t("adminNewTitle")}
      </h1>
      <PlaceForm
        mode="adminCreate"
        initial={EMPTY_PLACE_FORM}
        provinces={provinces}
        doneHref="/admin/places"
      />
    </div>
  );
}
