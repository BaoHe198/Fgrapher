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
