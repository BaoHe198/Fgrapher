import { redirect } from "next/navigation";

import {
  DashboardSidebar,
  MobileDashboardSidebar,
} from "@/components/layout/dashboard-sidebar";
import { PastDueBanner } from "@/components/layout/past-due-banner";
import { WebNav } from "@/components/layout/web-nav";
import { auth } from "@/lib/auth";
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

  return (
    <div className="flex min-h-dvh flex-col">
      <WebNav marketplaceEnabled={features.marketplaceEnabled} />
      <PastDueBanner userId={session.user.id} />

      <main
        id="main-content"
        className="mx-auto w-full max-w-[1240px] px-4 pt-6 pb-16 sm:px-8 sm:pt-8 sm:pb-[72px]"
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
