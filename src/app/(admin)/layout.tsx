import { redirect } from "next/navigation";
import Link from "next/link";

import { requireAdmin } from "@/lib/admin";
import { AuthError } from "@/lib/auth-helpers";

import { AdminSidebar } from "./admin-sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) {
      redirect("/login?callbackUrl=/admin");
    }
    // Authenticated but not an admin — bounce to the regular dashboard
    // rather than exposing a 403 with no way out.
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg-sunken">
      <div className="flex h-11 items-center gap-2 bg-neutral-900 px-4 text-body-sm font-semibold text-white">
        <span className="rounded bg-danger px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase">
          Admin
        </span>
        <span className="text-neutral-300">Fgrapher internal tools</span>
        <Link href="/dashboard" className="ml-auto text-neutral-300 hover:text-white">
          Exit admin
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
