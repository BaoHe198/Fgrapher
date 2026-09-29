-- Redesign 09/2026: provider-reported profile facts (years of experience,
-- deposit / cancellation / reschedule policy, travel radius), package
-- deliverables, and the Kỷ yếu (yearbook) style. Additive only: every new
-- column is nullable, nothing existing is rewritten.
--
-- Rollback: see prisma/rollbacks/20260929120000_add_redesign_profile_fields.sql.

-- AlterEnum
ALTER TYPE "ProfileCategory" ADD VALUE 'YEARBOOK';

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "cancellationPolicy" TEXT,
ADD COLUMN     "depositPercent" INTEGER,
ADD COLUMN     "depositPolicy" TEXT,
ADD COLUMN     "reschedulePolicy" TEXT,
ADD COLUMN     "serviceRadiusKm" INTEGER,
ADD COLUMN     "yearsExperience" INTEGER;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "deliveryDays" INTEGER,
ADD COLUMN     "editedPhotoCount" INTEGER;
