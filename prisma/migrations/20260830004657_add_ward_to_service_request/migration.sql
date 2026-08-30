-- AlterTable
ALTER TABLE "service_requests" ADD COLUMN     "wardId" TEXT;

-- CreateIndex
CREATE INDEX "service_requests_wardId_idx" ON "service_requests"("wardId");

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
