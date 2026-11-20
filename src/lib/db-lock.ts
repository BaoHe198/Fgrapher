import { Prisma } from "@prisma/client";

/**
 * Two requests arriving in the same instant.
 *
 * "Read, decide, write" is only safe if nobody else writes between the read
 * and the write, and nothing in a request handler guarantees that: a double
 * press, two tabs, or two admins on the same queue all get there. Found
 * 20/11/2026 by firing the same request several times at once — a cap of
 * five pending bookings took eight, two people opening a chat with each
 * other got two conversations, and so on.
 *
 * Two tools, both on a single connection (a transaction that waits on a lock
 * while its work runs on *other* pooled connections can starve itself when
 * the pool is small, as it is behind PgBouncer on serverless):
 *
 *  - lockInTransaction: serialises everyone using the same key until this
 *    transaction ends. The check and the write must both run on `tx`.
 *  - a conditional write (updateMany … where status = what was read), for
 *    "only one of you may move this row on" — see transitionBooking.
 */
export async function lockInTransaction(
  tx: Prisma.TransactionClient,
  key: string,
) {
  // Transaction-scoped: released on COMMIT or ROLLBACK, nothing to clean up.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

/**
 * Options for a transaction that takes a lock. Prisma's defaults (2s to get
 * a connection, 5s to finish) are too tight once requests queue behind each
 * other; a burst should wait its turn, not fail.
 */
export const LOCKED_TRANSACTION = { maxWait: 10_000, timeout: 20_000 } as const;

/** A unique constraint refused the write: the row is already there. */
export function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
