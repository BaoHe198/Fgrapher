import { db } from "@/lib/db";

/**
 * Which account an email address belongs to, whatever capitals it is typed
 * in.
 *
 * Addresses were stored exactly as typed and looked up exactly as typed, so
 * "An@Gmail.com" and "an@gmail.com" were two different accounts to the
 * database: the same person could register twice, and someone who signed up
 * with a capital letter could not sign in without it. New addresses are now
 * stored in lower case (registration, email change), and every lookup goes
 * through here.
 *
 * Rows stored before that are left as they are, which is why this does not
 * simply lower-case and compare: the exact match is tried first, then any
 * capitalisation, oldest account first — so an existing account keeps
 * working and, should two old rows differ only by case, the answer is at
 * least always the same one.
 */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const typed = email.trim();
  if (!typed) return null;
  const exact = await db.user.findUnique({
    where: { email: typed },
    select: { id: true },
  });
  if (exact) return exact.id;
  const anyCase = await db.user.findFirst({
    where: { email: { equals: typed, mode: "insensitive" } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return anyCase?.id ?? null;
}
