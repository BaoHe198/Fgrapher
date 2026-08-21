// One-time production bootstrap: creates ONLY the first admin account.
// Production starts empty — this is deliberately not prisma/seed.ts and
// must never insert demo profiles, reviews, or bookings.
//
// Category/style values (ProfileCategory, Role, BookingStatus, etc.) are
// Postgres enums defined in the schema itself — `prisma migrate deploy`
// already creates them as part of the migration. There is no
// database-backed lookup table for them to seed here.
//
// Idempotent: safe to re-run. If the admin account already exists, this
// only makes sure the ADMIN role is granted — it never overwrites an
// existing password.
//
// Run with:
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' \
//     npx tsx --env-file=.env.production scripts/bootstrap-prod.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    console.error(
      "Usage: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' npx tsx --env-file=.env.production scripts/bootstrap-prod.ts",
    );
    process.exit(1);
  }
  return value;
}

async function main() {
  const email = requireEnv("ADMIN_EMAIL");
  const password = requireEnv("ADMIN_PASSWORD");

  // Surface which database this is about to run against — DATABASE_URL's
  // username embeds the Supabase project ref (postgres.<ref>), and the
  // pooler hostname alone doesn't distinguish projects (see
  // scripts/check-db-safety.mjs for why).
  const ref = (process.env.DATABASE_URL ?? "").match(/postgres\.([a-z0-9]+):/)?.[1];
  console.log(`Target database project ref: ${ref ?? "(could not parse DATABASE_URL)"}`);

  let user = await db.user.findUnique({ where: { email } });

  if (!user) {
    if (password.length < 8) {
      console.error("ADMIN_PASSWORD must be at least 8 characters.");
      process.exit(1);
    }
    const passwordHash = await bcrypt.hash(password, 12);
    user = await db.user.create({
      data: {
        email,
        passwordHash,
        name: "Admin",
        emailVerified: new Date(),
      },
    });
    console.log(`Created admin user ${email}`);
  } else {
    console.log(`User ${email} already exists — leaving their password untouched`);
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
