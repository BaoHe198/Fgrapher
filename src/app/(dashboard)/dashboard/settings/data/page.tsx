import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

import { DataSettingsContent } from "./data-settings-content";

export default async function DataSettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const userId = session.user.id;

  const [
    consentRecords,
    pendingDeletion,
    profileCount,
    bookingsAsCustomerCount,
    bookingsAsProviderCount,
    reviewsWrittenCount,
    reviewsReceivedCount,
    orderCount,
  ] = await Promise.all([
    db.consentRecord.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      distinct: ["purpose"],
      select: { purpose: true, granted: true },
    }),
    db.dataRequest.findFirst({
      where: {
        userId,
        type: "DELETION",
        status: { in: ["PENDING", "PROCESSING"] },
      },
    }),
    db.profile.count({ where: { userId } }),
    db.booking.count({ where: { customerId: userId } }),
    db.booking.count({ where: { providerId: userId } }),
    db.review.count({ where: { reviewerId: userId } }),
    db.review.count({ where: { reviewedId: userId } }),
    db.order.count({ where: { customerId: userId } }),
  ]);

  const consent = {
    MARKETING:
      consentRecords.find((r) => r.purpose === "MARKETING")?.granted ?? false,
    ANALYTICS:
      consentRecords.find((r) => r.purpose === "ANALYTICS")?.granted ?? false,
  };

  return (
    <DataSettingsContent
      initialConsent={consent}
      pendingDeletion={Boolean(pendingDeletion)}
      summary={{
        profiles: profileCount,
        bookingsAsCustomer: bookingsAsCustomerCount,
        bookingsAsProvider: bookingsAsProviderCount,
        reviewsWritten: reviewsWrittenCount,
        reviewsReceived: reviewsReceivedCount,
        orders: orderCount,
      }}
    />
  );
}
