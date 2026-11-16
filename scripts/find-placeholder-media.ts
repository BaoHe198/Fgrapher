// Ops script (owner checklist #27): finds leftover test images — the 1x1
// black pixels that once made dev profiles look broken — in any database.
//
//   npx tsx scripts/find-placeholder-media.ts            # list only (default)
//   npx tsx scripts/find-placeholder-media.ts --apply    # soft-delete them
//
// Reads DATABASE_URL from the environment / .env like the Prisma CLI, so to
// look at production, run it with production's URL in the environment —
// listing is read-only. --apply only stamps deletedAt (never a hard delete,
// per CLAUDE.md), so a row can be restored by clearing it. Public profile
// pages are cached for ~90 s and pick the change up after that.
import { PrismaClient } from "@prisma/client";

// Real photos are hundreds of pixels on each side; anything this small is a
// placeholder or a broken upload, never a portfolio image.
const MAX_PLACEHOLDER_SIDE = 4;

const db = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");
  const ref =
    (process.env.DATABASE_URL ?? "").match(/postgres\.([a-z0-9]+):/)?.[1] ??
    "(unknown)";
  console.log(`Database project ref: ${ref}${apply ? "  [APPLY]" : ""}`);

  const tiny = await db.profileMedia.findMany({
    where: {
      deletedAt: null,
      type: "IMAGE",
      OR: [
        { width: { lte: MAX_PLACEHOLDER_SIDE } },
        { height: { lte: MAX_PLACEHOLDER_SIDE } },
      ],
    },
    select: {
      id: true,
      url: true,
      width: true,
      height: true,
      moderationStatus: true,
      profile: { select: { user: { select: { username: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  // Rows without stored dimensions can't be judged here — counted so a
  // human knows whether to look at them by eye.
  const unknownSize = await db.profileMedia.count({
    where: { deletedAt: null, type: "IMAGE", width: null },
  });

  for (const m of tiny) {
    console.log(
      `${m.id}  ${m.width}x${m.height}  ${m.moderationStatus}  @${m.profile.user.username ?? "?"}  ${m.url}`,
    );
  }
  console.log(
    `\n${tiny.length} placeholder-sized image(s); ${unknownSize} image(s) with no stored size.`,
  );

  if (!apply || tiny.length === 0) {
    if (tiny.length > 0)
      console.log("List only. Re-run with --apply to soft-delete them.");
    return;
  }
  const { count } = await db.profileMedia.updateMany({
    where: { id: { in: tiny.map((m) => m.id) } },
    data: { deletedAt: new Date() },
  });
  console.log(`Soft-deleted ${count} image(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
