/**
 * Fields a provider gives Fgrapher for private operational use. Public and
 * pre-booking responses must pass Profile records through this boundary.
 */
export function omitPrivateProfileFields<
  T extends { address?: unknown; zaloUrl?: unknown },
>(profile: T): Omit<T, "address" | "zaloUrl"> {
  const { address, zaloUrl, ...publicProfile } = profile;
  void address;
  void zaloUrl;
  return publicProfile;
}

/**
 * The one case where a street address is public: a studio that chose to
 * show where it is (project owner, 26/11/2026).
 *
 * A studio is a place customers travel to, so its page may carry the number
 * and street. But a studio can also be a room in someone's home, so nothing
 * is shown until the studio itself turns off "làm mờ vị trí"
 * (Profile.hideExactLocation, which defaults to true). For every other
 * role the answer is always null: a freelancer's address is where they
 * live, and stays private whatever that setting says.
 *
 * The public boundary calls this before dropping `address`, and passes the
 * result on under its own name, so a private address can never ride along
 * by accident.
 */
export function publicStudioAddress(profile: {
  role: string;
  address?: string | null;
  hideExactLocation: boolean;
}): string | null {
  if (profile.role !== "STUDIO" || profile.hideExactLocation) return null;
  return profile.address?.trim() || null;
}
