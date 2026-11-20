-- The work calendar (project owner, 20/11/2026): a provider records jobs
-- taken outside Fgrapher, keeps a private note on each Fgrapher booking, and
-- can subscribe their phone's calendar to the whole schedule.
--
--   calendar_entries        the provider's own diary entries
--   booking_notes           one private note per participant per booking
--   users.calendarFeedToken the secret in the calendar-subscription URL
--
-- Additive only: two new empty tables and one nullable column. No existing
-- row changes, and a build from before this migration never reads any of it.
--
-- Hand-written, like the migrations before it: `prisma migrate dev` also
-- proposes `DROP INDEX "profiles_serviceKinds_gin"`, an index made by hand
-- in 20260922044000 that schema.prisma cannot express.
--
-- Rollback (loses every diary entry, private note and subscription address):
--   DROP TABLE "booking_notes";
--   DROP TABLE "calendar_entries";
--   DROP INDEX "users_calendarFeedToken_key";
--   ALTER TABLE "users" DROP COLUMN "calendarFeedToken";

ALTER TABLE "users" ADD COLUMN "calendarFeedToken" TEXT;

CREATE UNIQUE INDEX "users_calendarFeedToken_key" ON "users"("calendarFeedToken");

CREATE TABLE "calendar_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "locationAddress" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "price" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "calendar_entries_userId_startAt_idx" ON "calendar_entries"("userId", "startAt");

ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "booking_notes" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "booking_notes_bookingId_userId_key" ON "booking_notes"("bookingId", "userId");

CREATE INDEX "booking_notes_userId_idx" ON "booking_notes"("userId");

ALTER TABLE "booking_notes" ADD CONSTRAINT "booking_notes_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "booking_notes" ADD CONSTRAINT "booking_notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
