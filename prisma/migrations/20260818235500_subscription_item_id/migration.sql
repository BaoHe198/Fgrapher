-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN "stripeSubscriptionItemId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripeSubscriptionItemId_key" ON "subscriptions"("stripeSubscriptionItemId");
