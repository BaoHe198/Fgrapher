import { redirect } from "next/navigation";

import { SuspendedAccountNotice } from "@/components/auth/suspended-account-notice";
import {
  DashboardSidebar,
  MobileDashboardSidebar,
} from "@/components/layout/dashboard-sidebar";
import { PastDueBanner } from "@/components/layout/past-due-banner";
import { ReviewReminderBanner } from "@/components/layout/review-reminder-banner";
import { WebNav } from "@/components/layout/web-nav";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { features } from "@/lib/features";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // Google OAuth signups skip /api/auth/register entirely, so they never
  // hit its age-gate (CLAUDE.md rule 4) or its 3 ConsentRecord writes
  // (rule 6) — a credentials account always has dateOfBirth set at
  // registration, so its absence here is specifically the OAuth gap, not
  // a false positive. See src/app/onboarding/complete-profile/.
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { dateOfBirth: true, isSuspended: true, deletedAt: true },
  });

  // Same live-status check as requireAuth() (src/lib/auth-helpers.ts) —
  // that one covers every protected API route, this one covers page
  // rendering for the whole dashboard, since a JWT session issued before
  // a suspension/soft-delete stays technically valid until it expires
  // (no server-side revocation list).
  //
  // Renders a notice instead of redirect("/login") — that seemed like the
  // obvious fix but isn't: src/proxy.ts's edge middleware decodes the
  // same still-valid JWT with no DB call of its own, sees an
  // "authenticated" request hitting /login, and bounces it straight back
  // to /dashboard, an infinite redirect loop a real browser hits as
  // ERR_TOO_MANY_REDIRECTS (found via testing, not theoretical).
  // SuspendedAccountNotice calls next-auth/react's signOut() instead,
  // which actually clears the session cookie via a real POST before
  // navigating anywhere, so there's no token left for the middleware to
  // act on by the time it reaches /login.
  if (!user || user.isSuspended || user.deletedAt) {
    return <SuspendedAccountNotice />;
  }

  if (!user.dateOfBirth) {
    redirect("/onboarding/complete-profile");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <WebNav marketplaceEnabled={features.marketplaceEnabled} />
      <PastDueBanner userId={session.user.id} />
      <ReviewReminderBanner userId={session.user.id} />

      <main
        id="main-content"
        className="mx-auto w-full max-w-[1440px] px-4 pt-6 pb-16 sm:px-8 sm:pt-8 sm:pb-[72px]"
      >
        <div className="mb-4 lg:hidden">
          <MobileDashboardSidebar
            marketplaceEnabled={features.marketplaceEnabled}
          />
        </div>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[232px_1fr]">
          <aside className="sticky top-[104px] hidden lg:block">
            <DashboardSidebar
              marketplaceEnabled={features.marketplaceEnabled}
            />
          </aside>

          <div className="min-w-0">{children}</div>
        </div>
      </main>
    </div>
  );
}
