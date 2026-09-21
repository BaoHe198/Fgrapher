-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProfileCategory" ADD VALUE 'AO_DAI';
ALTER TYPE "ProfileCategory" ADD VALUE 'WEDDING_DRESS';
ALTER TYPE "ProfileCategory" ADD VALUE 'MENSWEAR';
ALTER TYPE "ProfileCategory" ADD VALUE 'EVENING_GOWN';
ALTER TYPE "ProfileCategory" ADD VALUE 'HISTORICAL';
ALTER TYPE "ProfileCategory" ADD VALUE 'COSPLAY';
ALTER TYPE "ProfileCategory" ADD VALUE 'KIDSWEAR';
ALTER TYPE "ProfileCategory" ADD VALUE 'ACCESSORIES';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'COSTUME_SHOP';
