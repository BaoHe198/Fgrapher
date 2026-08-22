/*
  Warnings:

  - You are about to drop the column `contentGuidelinesAcceptedAt` on the `profiles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "profiles" DROP COLUMN "contentGuidelinesAcceptedAt";

-- AlterTable
ALTER TABLE "user_roles" ADD COLUMN     "contentGuidelinesAcceptedAt" TIMESTAMP(3);
