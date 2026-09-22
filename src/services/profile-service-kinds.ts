import { db } from "@/lib/db";

/**
 * Rewrites Profile.serviceKinds from the profile's active packages.
 *
 * The column is a denormalised copy that exists so search can filter on
 * "who offers photography" without joining Service on every query. Anything
 * that changes a package must call this, or search quietly goes stale —
 * which is the standing cost of the copy and the reason it lives in exactly
 * one function.
 */
export async function syncProfileServiceKinds(profileId: string) {
  const services = await db.service.findMany({
    where: { profileId, isActive: true },
    select: { kind: true },
  });
  await db.profile.update({
    where: { id: profileId },
    data: { serviceKinds: [...new Set(services.map((s) => s.kind))] },
  });
}
