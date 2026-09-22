/**
 * Counts and times the queries behind a slow page, so an optimisation starts
 * from a measurement rather than a guess.
 *
 *     PRISMA_QUERY_LOG=1 npx tsx scripts/db-query-profile.ts
 *
 * Add a case to PROFILES for whatever is slow at the time. The output is
 * wall time, query count, total time inside the database, and the three
 * slowest statements — which together tell you whether the problem is one
 * bad query, a missing index, or an N+1.
 */
import { db } from "../src/lib/db";

interface Sample {
  ms: number;
  query: string;
}

let samples: Sample[] = [];

// @ts-expect-error -- the query event only exists when the client was built
// with log: [{ emit: "event" }], which PRISMA_QUERY_LOG turns on.
db.$on("query", (event: { duration: number; query: string }) => {
  samples.push({ ms: event.duration, query: event.query });
});

async function profile(label: string, run: () => Promise<unknown>) {
  samples = [];
  const started = Date.now();
  await run();
  const wall = Date.now() - started;
  const inDb = samples.reduce((sum, s) => sum + s.ms, 0);
  console.log(
    `\n${label}\n  ${wall}ms wall · ${samples.length} queries · ${inDb}ms in the database`,
  );
  [...samples]
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 3)
    .forEach((s) => console.log(`    ${s.ms}ms  ${s.query.slice(0, 96)}`));
}

async function main() {
  if (process.env.PRISMA_QUERY_LOG !== "1") {
    console.log(
      "Chạy lại với PRISMA_QUERY_LOG=1, nếu không sẽ không có số liệu truy vấn.",
    );
  }

  const product = await db.product.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  const { getProductDetail, searchProducts } =
    await import("../src/services/marketplace");

  if (product) {
    await profile("getProductDetail — trang /shop/[id]", () =>
      getProductDetail(product.id),
    );
  }
  await profile("searchProducts — trang /shop", () =>
    searchProducts({ page: 1 }),
  );

  // The three the header fires on every page load and then polls.
  const user = await db.user.findFirst({
    where: { email: "photographer@test.com" },
    select: { id: true },
  });
  if (user) {
    const { getCart } = await import("../src/services/marketplace");
    const { countUnreadNotifications } =
      await import("../src/services/notification");
    await profile("getCart — /api/cart", () => getCart(user.id));
    await profile("countUnreadNotifications — /api/notifications", () =>
      countUnreadNotifications(user.id),
    );
    await profile("session lookup — auth() trên mọi request", () =>
      db.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          name: true,
          firstName: true,
          username: true,
          roles: { select: { role: true, active: true } },
          profiles: { select: { role: true, displayName: true } },
        },
      }),
    );
  }

  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
