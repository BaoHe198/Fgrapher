/**
 * Backfills the columns and tables added by
 * `20260922_expand_provider_architecture`.
 *
 *   npx tsx scripts/backfill-provider-architecture.ts --dry-run
 *   npx tsx scripts/backfill-provider-architecture.ts
 *
 * Idempotent: every branch either skips rows that already have a value or
 * keys the row it creates off the source row, so running it twice changes
 * nothing the second time.
 *
 * `--dry-run` writes nothing and prints what it would do, including sample
 * rows for the one conversion a human should eyeball: turning a `date`
 * column plus an "HH:mm" string into a real instant.
 */
import type { Role, ServiceKind } from "@prisma/client";

import { db } from "../src/lib/db";

const DRY_RUN = process.argv.includes("--dry-run");

/**
 * Vietnam is UTC+7 all year — no daylight saving — so the conversion is a
 * fixed offset rather than a timezone database lookup. Written out longhand
 * because getting this wrong silently shifts every booking in history.
 */
const VN_OFFSET_HOURS = 7;

function vnLocalToInstant(date: Date, time: string): Date | null {
  const [hh, mm] = time.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  // `date` is a @db.Date, so its UTC calendar fields are the intended
  // local calendar day.
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hh - VN_OFFSET_HOURS,
      mm,
    ),
  );
}

const SERVICE_KIND_BY_ROLE: Partial<Record<Role, ServiceKind>> = {
  PHOTOGRAPHER: "PHOTOGRAPHY",
  VIDEOGRAPHER: "VIDEOGRAPHY",
  MAKEUP_ARTIST: "MAKEUP",
  MODEL: "MODELING",
  // A studio's existing packages could be venue hire or a shoot; the plan
  // says to assume the one thing every studio does and flag the rest for the
  // owner to confirm rather than guessing from the package name.
  STUDIO: "VENUE_RENTAL",
};

const report: string[] = [];
function note(line: string) {
  report.push(line);
  console.log(line);
}

/**
 * userId → the resource that holds their calendar.
 *
 * In a real run the resources already exist, because backfillResources()
 * runs first. In a dry run they do not, and looking only at existing rows
 * made the report claim every availability row was an orphan — a report
 * that lies is worse than no report, so this falls back to "the profile
 * that WOULD get a resource".
 */
async function resourceOwnerMap() {
  const profiles = await db.profile.findMany({
    where: { role: { in: Object.keys(SERVICE_KIND_BY_ROLE) as Role[] } },
    select: {
      userId: true,
      resources: { select: { id: true }, take: 1 },
    },
  });
  return new Map(
    profiles.map((p) => [p.userId, p.resources[0]?.id ?? null] as const),
  );
}

async function backfillServiceKinds() {
  const services = await db.service.findMany({
    where: { kind: null },
    select: { id: true, name: true, profile: { select: { role: true } } },
  });

  const byKind = new Map<string, number>();
  let unmapped = 0;
  for (const service of services) {
    const kind = SERVICE_KIND_BY_ROLE[service.profile.role];
    if (!kind) {
      unmapped++;
      continue;
    }
    byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
    if (!DRY_RUN) {
      await db.service.update({ where: { id: service.id }, data: { kind } });
    }
  }

  note(
    `Service.kind: ${services.length} cần gán → ${[...byKind]
      .map(([k, n]) => `${k}=${n}`)
      .join(", ")}${unmapped ? `, KHÔNG MAP ĐƯỢC=${unmapped}` : ""}`,
  );
}

async function backfillProfileServiceKinds() {
  const profiles = await db.profile.findMany({
    select: {
      id: true,
      role: true,
      services: { where: { isActive: true }, select: { kind: true } },
    },
  });

  let written = 0;
  for (const profile of profiles) {
    const kinds = [
      ...new Set(
        profile.services
          .map((s) => s.kind)
          .filter((k): k is ServiceKind => k !== null),
      ),
    ];
    // A provider with no packages yet still gets the one kind its role
    // implies, otherwise it would vanish from a service-filtered search.
    if (kinds.length === 0) {
      const fallback = SERVICE_KIND_BY_ROLE[profile.role];
      if (fallback) kinds.push(fallback);
    }
    if (kinds.length === 0) continue;
    written++;
    if (!DRY_RUN) {
      await db.profile.update({
        where: { id: profile.id },
        data: { serviceKinds: kinds },
      });
    }
  }
  note(`Profile.serviceKinds: ${written}/${profiles.length} hồ sơ được gán`);
}

async function backfillResources() {
  const profiles = await db.profile.findMany({
    where: { role: { in: Object.keys(SERVICE_KIND_BY_ROLE) as Role[] } },
    select: { id: true, resources: { select: { id: true } } },
  });
  const missing = profiles.filter((p) => p.resources.length === 0);

  if (!DRY_RUN) {
    for (const profile of missing) {
      await db.bookableResource.create({
        data: { profileId: profile.id, type: "PROVIDER_SELF" },
      });
    }
  }
  note(
    `BookableResource: ${missing.length} hồ sơ chưa có tài nguyên (tổng ${profiles.length})`,
  );
}

async function backfillAvailability() {
  const rules = await db.availability.findMany();
  const blocks = await db.blockedDate.findMany();

  // Keyed on userId in the old tables, so the lookup goes through the owner.
  // One provider profile per account — the owner's decision — means one
  // resource per user.
  const byUser = await resourceOwnerMap();

  let ruleCount = 0;
  let orphanRules = 0;
  for (const rule of rules) {
    const known = byUser.has(rule.userId);
    const resourceId = byUser.get(rule.userId) ?? null;
    if (!known) {
      orphanRules++;
      continue;
    }
    ruleCount++;
    if (!DRY_RUN && resourceId) {
      const exists = await db.availabilityRule.findFirst({
        where: {
          resourceId,
          dayOfWeek: rule.dayOfWeek,
          startTime: rule.startTime,
          endTime: rule.endTime,
        },
      });
      if (!exists) {
        await db.availabilityRule.create({
          data: {
            resourceId,
            dayOfWeek: rule.dayOfWeek,
            startTime: rule.startTime,
            endTime: rule.endTime,
            isActive: rule.isActive,
          },
        });
      }
    }
  }

  let blockCount = 0;
  let orphanBlocks = 0;
  for (const block of blocks) {
    const known = byUser.has(block.userId);
    const resourceId = byUser.get(block.userId) ?? null;
    if (!known) {
      orphanBlocks++;
      continue;
    }
    const startAt = vnLocalToInstant(block.date, block.startTime ?? "00:00");
    const endAt = vnLocalToInstant(block.date, block.endTime ?? "23:59");
    if (!startAt || !endAt) continue;
    blockCount++;
    if (!DRY_RUN && resourceId) {
      const exists = await db.availabilityBlock.findFirst({
        where: { resourceId, startAt, endAt },
      });
      if (!exists) {
        await db.availabilityBlock.create({
          data: { resourceId, startAt, endAt, reason: block.reason },
        });
      }
    }
  }

  note(
    `AvailabilityRule: ${ruleCount}/${rules.length} chuyển được${orphanRules ? `, ${orphanRules} không tìm thấy hồ sơ` : ""}`,
  );
  note(
    `AvailabilityBlock: ${blockCount}/${blocks.length} chuyển được${orphanBlocks ? `, ${orphanBlocks} không tìm thấy hồ sơ` : ""}`,
  );
}

async function backfillBookingInstants() {
  const bookings = await db.booking.findMany({
    where: { startAt: null },
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      status: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const samples: string[] = [];
  let converted = 0;
  for (const booking of bookings) {
    const startAt = vnLocalToInstant(booking.date, booking.startTime);
    const endAt = booking.endTime
      ? vnLocalToInstant(booking.date, booking.endTime)
      : null;
    if (!startAt) continue;
    converted++;
    if (samples.length < 10) {
      samples.push(
        `    ${booking.date.toISOString().slice(0, 10)} ${booking.startTime}` +
          `${booking.endTime ? `-${booking.endTime}` : ""} (giờ VN)` +
          ` → ${startAt.toISOString()}${endAt ? ` … ${endAt.toISOString()}` : ""}`,
      );
    }
    if (!DRY_RUN) {
      await db.booking.update({
        where: { id: booking.id },
        data: { startAt, endAt },
      });
    }
  }

  note(`Booking.startAt/endAt: ${converted}/${bookings.length} chuyển được`);
  if (samples.length > 0) {
    note("  mẫu để kiểm tay (giờ VN = UTC+7):");
    samples.forEach((line) => note(line));
  }
}

async function backfillAllocations() {
  const HOLDING: ("PENDING" | "CONFIRMED")[] = ["PENDING", "CONFIRMED"];
  const bookings = await db.booking.findMany({
    where: { status: { in: HOLDING }, startAt: { not: null } },
    select: {
      id: true,
      providerId: true,
      startAt: true,
      endAt: true,
      allocations: { select: { id: true } },
    },
  });

  const byUser = await resourceOwnerMap();

  let created = 0;
  let skipped = 0;
  for (const booking of bookings) {
    if (booking.allocations.length > 0) continue;
    const resourceId = byUser.get(booking.providerId) ?? null;
    if (!byUser.has(booking.providerId) || !booking.startAt) {
      skipped++;
      continue;
    }
    created++;
    if (!DRY_RUN && resourceId) {
      await db.bookingAllocation.create({
        data: {
          bookingId: booking.id,
          resourceId,
          startAt: booking.startAt,
          // A booking with no end time is treated as one hour, which is what
          // the availability engine already assumed for these.
          endAt:
            booking.endAt ?? new Date(booking.startAt.getTime() + 3_600_000),
        },
      });
    }
  }
  note(
    `BookingAllocation: ${created} tạo mới (${bookings.length} booking đang giữ chỗ${skipped ? `, ${skipped} bỏ qua vì không có tài nguyên` : ""})`,
  );
}

async function backfillVenues() {
  // Only roles whose address is a place of business. A freelancer's address
  // is their home and stays where it is, blurred, on the Fmap.
  const VENUE_ROLES: Role[] = ["STUDIO", "CAMERA_SHOP", "COSTUME_SHOP"];
  const profiles = await db.profile.findMany({
    where: { role: { in: VENUE_ROLES }, address: { not: null } },
    select: {
      id: true,
      role: true,
      address: true,
      provinceId: true,
      wardId: true,
      latitude: true,
      longitude: true,
      venues: { select: { id: true } },
    },
  });
  const missing = profiles.filter((p) => p.venues.length === 0);

  if (!DRY_RUN) {
    for (const profile of missing) {
      await db.venue.create({
        data: {
          profileId: profile.id,
          address: profile.address!,
          provinceId: profile.provinceId,
          wardId: profile.wardId,
          latitude: profile.latitude,
          longitude: profile.longitude,
          isPrimary: true,
        },
      });
    }
  }
  note(
    `Venue: ${missing.length} tạo mới từ địa chỉ hồ sơ (studio/shop có địa chỉ: ${profiles.length})`,
  );
}

async function main() {
  console.log(
    DRY_RUN
      ? "=== CHẠY THỬ — không ghi gì vào database ===\n"
      : "=== GHI THẬT vào database ===\n",
  );

  await backfillServiceKinds();
  await backfillProfileServiceKinds();
  await backfillResources();
  await backfillAvailability();
  await backfillBookingInstants();
  await backfillAllocations();
  await backfillVenues();

  console.log(
    DRY_RUN
      ? "\n=== Hết chạy thử. Chạy lại không có --dry-run để ghi thật. ==="
      : "\n=== Xong. ===",
  );
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error("THẤT BẠI:", error);
  await db.$disconnect();
  process.exit(1);
});
