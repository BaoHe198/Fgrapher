import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

import { CompleteProfileForm } from "./complete-profile-form";

export const metadata: Metadata = { title: "Hoàn tất hồ sơ — Fgrapher" };

// Reached from (dashboard)/layout.tsx's gate — a Google OAuth signup never
// went through /api/auth/register, so it has no dateOfBirth (CLAUDE.md
// rule 4, mọi tài khoản 18+) and no ConsentRecord rows at all (rule 6).
// This is the equivalent step, collected here on first dashboard visit
// instead of at signup.
export default async function CompleteProfilePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/onboarding/complete-profile");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { dateOfBirth: true },
  });
  if (user?.dateOfBirth) {
    // Already completed (or a credentials account, which always has this
    // set at registration) — nothing to do here.
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-16">
      <div className="space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            Hoàn tất hồ sơ
          </h1>
          <p className="mx-auto max-w-sm text-muted-foreground">
            Chỉ còn một bước nữa trước khi bạn có thể dùng Fgrapher — chúng tôi
            cần xác nhận ngày sinh và sự đồng ý xử lý dữ liệu cá nhân của bạn.
          </p>
        </div>

        <CompleteProfileForm />
      </div>
    </div>
  );
}
