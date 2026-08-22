-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('NEW', 'INTERMEDIATE', 'EXPERIENCED', 'PROFESSIONAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProfileCategory" ADD VALUE 'FASHION_MODEL';
ALTER TYPE "ProfileCategory" ADD VALUE 'COMMERCIAL_MODEL';
ALTER TYPE "ProfileCategory" ADD VALUE 'FITNESS_MODEL';
ALTER TYPE "ProfileCategory" ADD VALUE 'PORTRAIT_MODEL';
ALTER TYPE "ProfileCategory" ADD VALUE 'HAND_FOOT_MODEL';
ALTER TYPE "ProfileCategory" ADD VALUE 'PLUS_SIZE';
ALTER TYPE "ProfileCategory" ADD VALUE 'PETITE';
ALTER TYPE "ProfileCategory" ADD VALUE 'MATURE';
ALTER TYPE "ProfileCategory" ADD VALUE 'ALTERNATIVE';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'MODEL';

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "agencyName" TEXT,
ADD COLUMN     "agencyRepresented" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "experienceLevel" "ExperienceLevel",
ADD COLUMN     "eyeColor" TEXT,
ADD COLUMN     "hairColor" TEXT,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "measurements" TEXT,
ADD COLUMN     "shoeSize" TEXT,
ADD COLUMN     "travelWilling" BOOLEAN NOT NULL DEFAULT false;
