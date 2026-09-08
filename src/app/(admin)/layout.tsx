import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { SuspendedAccountNotice } from "@/components/auth/suspended-account-notice";
import { requireAdmin } from "@/lib/admin";
import { auth } from "@/lib/auth";
import { AuthError } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

import { AdminSidebar, MobileAdminSidebar } from "./admin-sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Same live isSuspended/deletedAt check and same reasoning as
  // (dashboard)/layout.tsx — checked explicitly here, BEFORE
  // requireAdmin() (which calls requireAuth(), which now throws the same
  // generic 401 for this case too), specifically so this can render
  // SuspendedAccountNotice instead of redirect("/login?callbackUrl=/admin").
  // That redirect used to be fine because it only ever fired for "no
  // session at all" — but it shares src/proxy.ts's edge middleware with
  // every other route, which bounces a request to /login right back out
  // whenever it still finds a valid (if now-suspended) JWT, an infinite
  // loop for a suspended admin visiting /admin (confirmed for the
  // dashboard's identical case; same root cause here).
  const session = await auth();
  if (session?.user) {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { isSuspended: true, deletedAt: true },
    });
    if (!user || user.isSuspended || user.deletedAt) {
      return <SuspendedAccountNotice />;
    }
  }

  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) {
      redirect("/login?callbackUrl=/admin");
    }
    // Authenticated but not an admin — 404, not a redirect, so this
    // doesn't confirm to a logged-in non-admin that /admin/* is even a
    // real section of the app.
    notFound();
  }

  const t = await getTranslations("accountFlows.admin.layout");

  return (
    <div className="flex min-h-dvh flex-col bg-bg-sunken">
      <div className="flex h-11 items-center gap-2 bg-neutral-900 px-4 text-body-sm font-semibold! text-white">
        <span className="rounded bg-danger px-1.5 py-0.5 text-sm font-bold tracking-wide uppercase">
          {t("badge")}
        </span>
        <span className="text-neutral-300">{t("subtitle")}</span>
        <Link
          href="/dashboard"
          className="ml-auto text-neutral-300 hover:text-white"
        >
          {t("exitAdmin")}
        </Link>
      </div>

      <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-8">
        <div className="mb-4 lg:hidden">
          <MobileAdminSidebar />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_1fr]">
          <aside className="hidden lg:block">
            <AdminSidebar />
          </aside>
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
