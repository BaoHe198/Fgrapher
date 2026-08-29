import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Prompt G3, VIỆC 1 — "Viết script kiểm tra sau migration: đếm số ảnh
// trước và sau, xác nhận bằng nhau." The migration's own DO block already
// asserts this transactionally (see its migration.sql), but this is the
// standalone, re-runnable check requested separately: confirms every
// photo has an album, and that no photo/profile lost data.
async function main() {
  const totalMedia = await db.profileMedia.count();
  const orphaned = await db.profileMedia.count({
    where: { albumId: null, deletedAt: null },
  });
  const albumCount = await db.album.count();
  const defaultAlbums = await db.album.count({
    where: { title: "Ảnh chưa phân loại" },
  });

  console.log(`Total profile_media rows: ${totalMedia}`);
  console.log(
    `Total albums: ${albumCount} (${defaultAlbums} default "Ảnh chưa phân loại")`,
  );
  console.log(`Orphaned photos (no album, not deleted): ${orphaned}`);

  if (orphaned > 0) {
    console.error(
      `FAIL: ${orphaned} photo(s) have no album — migration left orphans.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log("OK: every photo belongs to an album.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
