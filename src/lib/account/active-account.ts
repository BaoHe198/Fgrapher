/**
 * An account that may be seen in public: neither deactivated/deleted nor
 * suspended. Profile search has applied this from the start
 * (PUBLIC_USER_FILTER in services/search.ts); Chợ F listings and community
 * posts did not, so a suspended seller's listings stayed for sale and a
 * deactivated author's posts stayed in the feed.
 */
export const ACTIVE_ACCOUNT = { deletedAt: null, isSuspended: false } as const;
