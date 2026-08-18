-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "locationAddress" TEXT,
ADD COLUMN     "locationType" TEXT,
ADD COLUMN     "numberOfPeople" INTEGER,
ADD COLUMN     "referenceImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "rescheduleProposedBy" TEXT,
ADD COLUMN     "rescheduleProposedDate" DATE,
ADD COLUMN     "rescheduleProposedEndTime" TEXT,
ADD COLUMN     "rescheduleProposedStartTime" TEXT;
