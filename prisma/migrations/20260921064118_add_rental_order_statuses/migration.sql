-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'PICKED_UP';
ALTER TYPE "OrderStatus" ADD VALUE 'OVERDUE';

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "returnedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "damageFeeAmount" DOUBLE PRECISION,
ADD COLUMN     "lateFeeAmount" DOUBLE PRECISION,
ADD COLUMN     "returnNote" TEXT;
