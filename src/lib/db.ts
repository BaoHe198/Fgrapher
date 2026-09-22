import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * `PRISMA_QUERY_LOG=1` makes the client emit a query event per statement,
 * which is how you find out whether a slow page is one bad query or forty
 * reasonable ones. Off by default and never on in production: the events
 * carry query text and would otherwise be noise in the logs.
 *
 * Use it with scripts/db-query-profile.ts.
 */
const QUERY_LOG = process.env.PRISMA_QUERY_LOG === "1";

export const db =
  globalForPrisma.prisma ??
  new PrismaClient(
    QUERY_LOG ? { log: [{ emit: "event", level: "query" }] } : undefined,
  );

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
