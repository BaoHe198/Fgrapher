import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { usernameBase } from "@/lib/username";

/**
 * Gives an account a username if it has none. The username is the address of
 * the public profile (/profile/<username>); sign-up never set one, so a new
 * provider's search card linked to /profile/ — a 404 — until they happened to
 * choose one in settings. They can still change it there.
 *
 * Tries the plain base first, then the base with a random number; the unique
 * index is the real guard, so a lost race just tries the next candidate.
 * Never throws: a missing username must not block sign-up or sign-in.
 */
export async function assignUsernameIfMissing(userId: string) {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { username: true, name: true, email: true, deletedAt: true },
    });
    if (!user || user.username || user.deletedAt) return user?.username ?? null;

    const base = usernameBase(user.name, user.email);
    for (let attempt = 0; attempt < 6; attempt++) {
      const candidate =
        attempt === 0
          ? base
          : `${base}${Math.floor(100 + Math.random() * (attempt < 3 ? 900 : 99900))}`;
      try {
        const updated = await db.user.updateMany({
          where: { id: userId, username: null },
          data: { username: candidate },
        });
        if (updated.count > 0) return candidate;
        return (
          (
            await db.user.findUnique({
              where: { id: userId },
              select: { username: true },
            })
          )?.username ?? null
        );
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          continue; // taken — try another
        }
        throw err;
      }
    }
    return null;
  } catch {
    return null;
  }
}
