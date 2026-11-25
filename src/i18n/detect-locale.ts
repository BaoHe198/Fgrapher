/**
 * The interface language for a first visit, from the browser's
 * Accept-Language header — honouring its order and q-weights.
 *
 * The proxy used to take the first of our locales that appeared anywhere in
 * the header, checking "en" first. A typical Chrome in Vietnam sends
 * "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7", and Safari lists English as well,
 * so most first-time visitors here got the English interface (found
 * 25/11/2026 testing on WebKit). Now the most preferred language we offer
 * wins; with none, Vietnamese (the default).
 */
export function detectLocale<L extends string>(
  acceptLanguage: string | null | undefined,
  locales: readonly L[],
  defaultLocale: L,
): L {
  const ranked = (acceptLanguage ?? "")
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((param) => param.trim())
        .find((param) => param.startsWith("q="));
      const weight = q ? Number.parseFloat(q.slice(2)) : 1;
      return {
        language: tag.trim().toLowerCase().split("-")[0],
        weight: Number.isFinite(weight) ? weight : 0,
        index,
      };
    })
    .filter((entry) => entry.language && entry.weight > 0)
    // Highest weight first; equal weights keep the header's order.
    .sort((a, b) => b.weight - a.weight || a.index - b.index);

  for (const entry of ranked) {
    const match = locales.find((locale) => locale === entry.language);
    if (match) return match;
  }
  return defaultLocale;
}
