/**
 * A provider's "from" price, and how a price filter matches it.
 *
 * A profile has two sources for it: the price range the provider may type
 * into their profile settings (Profile.priceMin / priceMax) and the packages
 * they sell (Service.price). The public profile page has always read the
 * packages; browse cards, the price filter, price sorting and the map read
 * only the typed range. A provider who added a 1.500.000₫ package and left
 * the range empty was therefore "Từ 1.500.000₫" on their own page, "Hỏi
 * giá" on every card, and absent from any search that filtered by price.
 *
 * The rule here, used by all of those: the typed range wins where the
 * provider filled it in; where they did not, the active packages speak.
 *
 * Kept free of Prisma imports so it can be unit-tested; the `where` shape is
 * structurally a Prisma.ProfileWhereInput.
 */

/** Relation select that loads what startingPrice() needs. */
export const ACTIVE_SERVICE_PRICES = {
  where: { isActive: true },
  select: { price: true },
} as const;

export function startingPrice(profile: {
  priceMin: number | null;
  services: readonly { price: number }[];
}): number | null {
  if (profile.priceMin != null) return profile.priceMin;
  if (profile.services.length === 0) return null;
  return Math.min(...profile.services.map((service) => service.price));
}

/**
 * Clauses (to be AND-ed) for "this profile has something priced between
 * minPrice and maxPrice". Either bound may be absent.
 */
export function priceFilterClauses(minPrice?: number, maxPrice?: number) {
  const clauses = [];
  if (maxPrice !== undefined) {
    clauses.push({
      OR: [
        { priceMin: { lte: maxPrice } },
        {
          priceMin: null,
          services: { some: { isActive: true, price: { lte: maxPrice } } },
        },
      ],
    });
  }
  if (minPrice !== undefined) {
    clauses.push({
      OR: [
        { priceMax: { gte: minPrice } },
        // "From 3.000.000₫" with no upper end still reaches a 2.500.000₫
        // floor.
        { priceMax: null, priceMin: { gte: minPrice } },
        {
          priceMax: null,
          priceMin: null,
          services: { some: { isActive: true, price: { gte: minPrice } } },
        },
      ],
    });
  }
  return clauses;
}
