// One-off ops script that geocodes existing provider profiles for the Fmap map.
// Safe to re-run (idempotent) - it will only process profiles with PENDING status.
// Must be run against dev first, then production deliberately (see docs/MIGRATIONS.md)
// Usage: pnpm db:backfill:coordinates [--dry-run] [--limit=N] [--retry-failed]
// MAPTILER_API_KEY must be exported in the shell (tsx does not load .env).
import { PrismaClient } from "@prisma/client";
import {
  forwardGeocode,
  buildGeocodeAddressHash,
  type GeocodeAddress,
} from "../src/services/geocoding";

const db = new PrismaClient();

async function main() {
  // Parse command line arguments
  const dryRun = process.argv.includes("--dry-run");
  const retryFailed = process.argv.includes("--retry-failed");
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1]) : 200;

  // Check for required environment variable
  if (!process.env.MAPTILER_API_KEY && !dryRun) {
    console.error(
      "Error: MAPTILER_API_KEY is not set. Please export it before running this script.",
    );
    process.exit(1);
  }

  if (dryRun) {
    console.log("=== DRY RUN MODE ===");
    console.log(
      "This will only show which profiles would be geocoded without actually calling the API.",
    );
  }

  console.log(
    `Processing up to ${limit} profiles with PENDING status${retryFailed ? " or FAILED" : ""}`,
  );

  const profiles = await db.profile.findMany({
    where: {
      NOT: [{ address: null }, { address: "" }],
      wardId: { not: null },
      provinceId: { not: null },
      geocodingStatus: {
        in: retryFailed ? ["PENDING", "FAILED"] : ["PENDING"],
      },
    },
    include: {
      ward: true,
      province: true,
    },
    orderBy: {
      id: "asc",
    },
    take: limit,
  });

  if (profiles.length === 0) {
    console.log("No profiles found to geocode.");
    return;
  }

  console.log(`Found ${profiles.length} profiles to process`);

  let scanned = 0;
  let ready = 0;
  let failed = 0;
  let skipped = 0;

  for (const profile of profiles) {
    scanned++;

    // Build input for geocoding
    const input: GeocodeAddress = {
      address: profile.address!,
      ward: profile.ward!.name,
      province: profile.province!.name,
    };

    // Build hash to compare with existing hash
    const hash = buildGeocodeAddressHash(input);

    // Skip if profile is already geocoded and matching
    if (
      profile.geocodeAddressHash === hash &&
      profile.geocodingStatus === "READY"
    ) {
      skipped++;
      console.log(`SKIPPED (already geocoded) <profileId> ${profile.id}`);
      continue;
    }

    if (dryRun) {
      console.log(
        `WOULD GEOCODE <profileId> ${profile.id} <role> ${profile.role}`,
      );
      continue;
    }

    // Call forward geocoding
    const result = await forwardGeocode(input);

    try {
      if (result.success) {
        // Update profile with geocoded coordinates
        await db.profile.update({
          where: { id: profile.id },
          data: {
            latitude: result.latitude,
            longitude: result.longitude,
            geocodedAt: new Date(),
            geocodeAddressHash: hash,
            geocodingStatus: "READY",
          },
        });
        ready++;
      } else {
        // Update profile with failure
        await db.profile.update({
          where: { id: profile.id },
          data: {
            latitude: null,
            longitude: null,
            geocodedAt: null,
            geocodeAddressHash: hash,
            geocodingStatus: "FAILED",
          },
        });
        failed++;
        console.log(
          `FAILED <profileId> ${profile.id} <reason> ${result.reason}`,
        );
      }
    } catch (error) {
      failed++;
      console.log(
        `FAILED <profileId> ${profile.id} <reason> error updating database`,
      );
      console.error(error);
    }

    // Wait 250ms between API calls to stay under rate limits
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  console.log("\n=== SUMMARY ===");
  console.log(`Scanned: ${scanned}`);
  console.log(`Ready: ${ready}`);
  console.log(`Failed: ${failed}`);
  console.log(`Skipped: ${skipped}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
