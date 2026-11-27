import { redirect } from "next/navigation";

import { SuspendedAccountNotice } from "@/components/auth/suspended-account-notice";
import {
  DashboardSidebar,
  DashboardTabBar,
} from "@/components/layout/dashboard-sidebar";
import { PastDueBanner } from "@/components/layout/past-due-banner";
import { ScopedMessages } from "@/components/providers/scoped-messages";
import { SectionNav } from "@/components/layout/section-nav";
import { ReviewReminderBanner } from "@/components/layout/review-reminder-banner";
import { WebNav } from "@/components/layout/web-nav";
import { auth } from "@/lib/auth";
import { loadAccountStatus } from "@/lib/auth-helpers";
import { features } from "@/lib/features";
import { hasPublicPlaces } from "@/services/places";

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
  //
  // The photo-spot question for the menu is asked alongside it, not after it
  // (27/11/2026): the two do not depend on each other, and the page below
  // cannot start reading its own data until this layout has returned.
  const [user, placesEnabled] = await Promise.all([
    loadAccountStatus(session.user.id),
    hasPublicPlaces(),
  ]);

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
    return (
      <ScopedMessages scope="dashboard">
        <SuspendedAccountNotice />
      </ScopedMessages>
    );
  }

  if (!user.dateOfBirth) {
    redirect("/onboarding/complete-profile");
  }

  return (
    <ScopedMessages scope="dashboard">
      <DashboardShell placesEnabled={placesEnabled} userId={session.user.id}>
        {children}
      </DashboardShell>
    </ScopedMessages>
  );
}

// The page frame, split out only so the layout above can wrap it in one
// place; nothing about it changed.
function DashboardShell({
  placesEnabled,
  userId,
  children,
}: {
  placesEnabled: boolean;
  userId: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <WebNav
        marketplaceEnabled={features.marketplaceEnabled}
        socialFeedEnabled={features.socialFeedEnabled}
        placesEnabled={placesEnabled}
      />
      <PastDueBanner userId={userId} />
      <ReviewReminderBanner userId={userId} />

      {/* Below lg the menu is the tab bar fixed to the bottom edge, so the
          page keeps room for it under its last line. */}
      <main
        id="main-content"
        className="mx-auto w-full max-w-[1440px] px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-8 sm:pt-8 lg:pb-[72px]"
      >
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[232px_1fr]">
          <aside className="sticky top-[104px] hidden lg:block">
            <DashboardSidebar
              marketplaceEnabled={features.marketplaceEnabled}
            />
          </aside>

          <div className="min-w-0">
            <SectionNav marketplaceEnabled={features.marketplaceEnabled} />
            {children}
          </div>
        </div>
      </main>
      <DashboardTabBar marketplaceEnabled={features.marketplaceEnabled} />
    </div>
  );
}
