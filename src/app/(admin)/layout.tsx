import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { requireAdmin } from "@/lib/admin";
import { AuthError } from "@/lib/auth-helpers";

import { AdminSidebar } from "./admin-sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

      <div className="mx-auto grid w-full max-w-[1400px] flex-1 grid-cols-1 gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[200px_1fr]">
        <aside className="hidden lg:block">
          <AdminSidebar />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
