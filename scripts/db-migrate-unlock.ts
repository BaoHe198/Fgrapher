/**
 * Diagnoses and clears the state that makes `prisma migrate` fail with
 *
 *     P1002 ... Timed out trying to acquire a postgres advisory lock
 *
 * That error reads like "the database is unreachable", which sends you off
 * checking DNS and firewalls. It usually is not: `prisma migrate` takes a
 * session-level advisory lock first, and if a previous migrate run was
 * interrupted — killed, timed out, laptop closed — its session can survive
 * inside Supabase's pooler, idle, still holding the lock. Every later migrate
 * then waits 10 seconds and gives up.
 *
 * Run it read-only first:
 *     npx tsx scripts/db-migrate-unlock.ts
 * Then, if it reports an abandoned holder:
 *     npx tsx scripts/db-migrate-unlock.ts --terminate
 *
 * Only ever terminates a session that is BOTH idle and holding the migrate
 * advisory lock for over an hour. An active session is somebody's migration
 * actually running, and killing that is how you get a half-applied schema.
 */
import { db } from "../src/lib/db";

const TERMINATE = process.argv.includes("--terminate");
const ABANDONED_AFTER = "1 hour";

interface LockRow {
  pid: number;
  objid: number;
  granted: boolean;
  state: string | null;
  age: string | null;
  query: string | null;
}

async function main() {
  const locks = await db.$queryRawUnsafe<LockRow[]>(`
    select l.pid, l.objid, l.granted, a.state,
           coalesce((now() - a.state_change)::text, '') as age,
           left(coalesce(a.query, ''), 70) as query
    from pg_locks l
    left join pg_stat_activity a on a.pid = l.pid
    where l.locktype = 'advisory'
    order by l.granted desc, l.pid
  `);

  if (locks.length === 0) {
    console.log("Không có advisory lock nào — migrate không bị chặn ở đây.");
  }
  for (const lock of locks) {
    console.log(
      `pid=${lock.pid} objid=${lock.objid} granted=${lock.granted} ` +
        `state=${lock.state} tuổi=${lock.age}\n  query: ${lock.query}`,
    );
  }

  const abandoned = await db.$queryRawUnsafe<{ pid: number; age: string }[]>(`
    select l.pid, (now() - a.state_change)::text as age
    from pg_locks l
    join pg_stat_activity a on a.pid = l.pid
    where l.locktype = 'advisory' and l.granted
      and a.state = 'idle'
      and now() - a.state_change > interval '${ABANDONED_AFTER}'
  `);

  if (abandoned.length === 0) {
    console.log("\nKhông có session bỏ dở nào đang giữ khoá.");
  } else if (!TERMINATE) {
    console.log(
      `\n${abandoned.length} session bỏ dở đang giữ khoá. Chạy lại với --terminate để ngắt.`,
    );
  } else {
    for (const row of abandoned) {
      await db.$queryRawUnsafe(`select pg_terminate_backend(${row.pid})`);
      console.log(`Đã ngắt pid=${row.pid} (idle ${row.age}).`);
    }
  }

  // An interrupted `migrate dev` can also leave its shadow database behind.
  const shadows = await db.$queryRawUnsafe<{ datname: string }[]>(
    `select datname from pg_database where datname like 'prisma_migrate_shadow_db%'`,
  );
  console.log(
    shadows.length === 0
      ? "Không có shadow database sót lại."
      : `Shadow database sót lại (xoá tay nếu chắc không có migrate nào đang chạy): ${shadows
          .map((s) => s.datname)
          .join(", ")}`,
  );

  await db.$disconnect();
}

main().catch(async (error) => {
  console.error("Thất bại:", error);
  await db.$disconnect();
  process.exit(1);
});
