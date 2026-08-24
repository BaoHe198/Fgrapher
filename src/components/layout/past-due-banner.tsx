import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { db } from "@/lib/db";

export async function PastDueBanner({ userId }: { userId: string }) {
  const pastDue = await db.subscription.findFirst({
    where: {
      userRole: { userId },
      status: "PAST_DUE",
      graceEndsAt: { gt: new Date() },
    },
    include: { userRole: true },
    orderBy: { graceEndsAt: "asc" },
  });

  if (!pastDue?.graceEndsAt) return null;

  // Server Component — renders once per request on the server, never
  // reconciled/memoized by the (client-only) React Compiler, so a one-time
  // Date.now() read here can't produce the stale-UI problem this rule guards
  // against.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const daysLeft = Math.max(
    0,
    Math.ceil((pastDue.graceEndsAt.getTime() - nowMs) / 86_400_000),
  );

  const [t, roleT] = await Promise.all([
    getTranslations("sharedComponents.pastDueBanner"),
    getTranslations("role"),
  ]);

  return (
    <div className="sticky top-[72px] z-10 flex items-center justify-center gap-3 bg-warning-bg px-4 py-2.5 text-center text-body-sm text-warning">
      <span>
        {t("message", {
          role: roleT(pastDue.userRole.role),
          days: daysLeft,
        })}
      </span>
      <Link
        href="/dashboard/settings/billing"
        className="font-semibold underline"
      >
        {t("updatePayment")}
      </Link>
    </div>
  );
}
