import { monthRuns } from "@/lib/places";

type PlacesT = (
  key: "month" | "monthRange" | "allYear",
  values?: Record<string, number>,
) => string;

/**
 * "Tháng 11 – Tháng 2, Tháng 6" from [11, 12, 1, 2, 6]: consecutive months
 * read as one range. Empty string when no month is set.
 */
export function monthsLabel(months: number[], t: PlacesT): string {
  const runs = monthRuns(months);
  if (runs.length === 1 && runs[0][0] === 1 && runs[0][1] === 12) {
    return t("allYear");
  }
  return runs
    .map(([from, to]) =>
      from === to ? t("month", { month: from }) : t("monthRange", { from, to }),
    )
    .join(", ");
}
