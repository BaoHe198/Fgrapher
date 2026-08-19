import Link from "next/link";

import { db } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/constants";

export async function PastDueBanner({ userId }: { userId: string }) {
  const pastDue = await db.subscription.findFirst({
    where: { userRole: { userId }, status: "PAST_DUE", graceEndsAt: { gt: new Date() } },
    include: { userRole: true },
    orderBy: { graceEndsAt: "asc" },
  });

  if (!pastDue?.graceEndsAt) return null;

  const daysLeft = Math.max(
    0,
    Math.ceil((pastDue.graceEndsAt.getTime() - Date.now()) / 86_400_000),
  );

  return (
    <div className="sticky top-[72px] z-10 flex items-center justify-center gap-3 bg-warning-bg px-4 py-2.5 text-center text-body-sm text-warning">
      <span>
        Your {ROLE_LABELS[pastDue.userRole.role]} payment failed. Update your payment method to
        keep your profile live. {daysLeft} {daysLeft === 1 ? "day" : "days"} remaining.
      </span>
      <Link href="/dashboard/settings/billing" className="font-semibold underline">
        Update payment
      </Link>
    </div>
  );
}
