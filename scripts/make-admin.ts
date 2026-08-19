// One-time dev/ops script: grants the ADMIN role to an existing account.
// Run with: npx tsx scripts/make-admin.ts your@email.com
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx scripts/make-admin.ts <email>");
    process.exit(1);
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found with email ${email}`);
    process.exit(1);
  }

  await db.userRole.upsert({
    where: { userId_role: { userId: user.id, role: "ADMIN" } },
    create: { userId: user.id, role: "ADMIN", active: true },
    update: { active: true },
  });

  console.log(`Granted ADMIN to ${email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
