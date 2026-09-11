// One rule for "what do we call this person in the UI", so the same provider
// isn't "Đi Tìm PhotoBOOK" on their public profile and "Bao He" in a chat with
// them.
//
// A provider's public identity is their Profile.displayName — that is the name
// they chose to trade under, and it is what /profile/[username] has always
// shown. The chat panel and the conversation list each had their own private
// copy of this logic that only looked at the User row, so they showed the
// account holder's personal name instead and disagreed with the profile.
//
// displayName first, then the personal name (first name reads better than the
// full one in a conversation), then the handle.

export interface NamedParty {
  name: string | null;
  firstName: string | null;
  username?: string | null;
  /**
   * The party's published profiles, newest-selected-first — only
   * `displayName` is needed. Absent for a plain customer, who has no provider
   * profile and is therefore known by their account name.
   */
  profiles?: { displayName: string | null }[] | null;
}

export function resolvePartyName(party: NamedParty, fallback: string): string {
  const displayName = party.profiles?.find((p) => p.displayName)?.displayName;
  return (
    displayName ?? party.firstName ?? party.name ?? party.username ?? fallback
  );
}
