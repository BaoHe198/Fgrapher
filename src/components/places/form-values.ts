import type { Place } from "@prisma/client";

import type { PlaceFormValues } from "@/components/places/place-form";

/** A saved spot as the form edits it. */
export function placeToFormValues(place: Place): PlaceFormValues {
  return {
    name: place.name,
    description: place.description,
    kind: place.kind,
    categories: place.categories,
    provinceId: place.provinceId,
    wardId: place.wardId ?? "",
    address: place.address ?? "",
    pin: { latitude: place.latitude, longitude: place.longitude },
    bestTimeNote: place.bestTimeNote ?? "",
    bestMonths: place.bestMonths,
    fee:
      place.entryFeeVnd == null
        ? "unknown"
        : place.entryFeeVnd === 0
          ? "free"
          : "paid",
    entryFeeVnd:
      place.entryFeeVnd && place.entryFeeVnd > 0
        ? new Intl.NumberFormat("vi-VN").format(place.entryFeeVnd)
        : "",
    feeNote: place.feeNote ?? "",
    permit:
      place.permitRequired == null
        ? "unknown"
        : place.permitRequired
          ? "yes"
          : "no",
    rulesNote: place.rulesNote ?? "",
    crowdNote: place.crowdNote ?? "",
    parkingNote: place.parkingNote ?? "",
  };
}
