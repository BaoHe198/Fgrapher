-- Provider-controlled contact link, disclosed only after a booking is created.
ALTER TABLE "profiles" ADD COLUMN "zaloUrl" TEXT;

-- Daily prompt for providers to keep their busy calendar accurate.
ALTER TYPE "NotificationType" ADD VALUE 'AVAILABILITY_REMINDER';
