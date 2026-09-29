// How fast a provider answers booking requests, as a public label
// ("Thường trong 2 giờ"). Pure, so the bucketing is unit-tested apart from
// the query in services/profile-stats.ts.

/** Fewer answered requests than this and the figure means nothing. */
export const MIN_RESPONSE_SAMPLES = 3;

/** Median of the samples, or null when there are too few to say. */
export function medianMinutes(samples: number[]): number | null {
  if (samples.length < MIN_RESPONSE_SAMPLES) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export type ResponseBucket =
  | { unit: "hour"; value: 1 }
  | { unit: "hours"; value: number }
  | { unit: "day"; value: 1 }
  | { unit: "days"; value: number };

/**
 * Rounds a median UP to a promise the provider actually keeps: 50 minutes
 * reads "within 1 hour", 2h10 reads "within 3 hours", 30 hours "within 2
 * days". Rounding down would overstate them.
 */
export function responseBucket(minutes: number): ResponseBucket {
  if (minutes <= 60) return { unit: "hour", value: 1 };
  if (minutes < 24 * 60)
    return { unit: "hours", value: Math.ceil(minutes / 60) };
  if (minutes <= 24 * 60) return { unit: "day", value: 1 };
  return { unit: "days", value: Math.ceil(minutes / (24 * 60)) };
}
