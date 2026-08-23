import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { PAID_ROLES, ROLE_LABELS } from "@/lib/constants";
import { db } from "@/lib/db";

import { VerificationForm } from "./verification-form";

const STATUS_LABELS: Record<string, string> = {
  UNVERIFIED: "Not started",
  PENDING: "Under review",
  VERIFIED: "Verified",
  REJECTED: "Needs resubmission",
};

export default async function OnboardingVerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { role: roleParam } = await searchParams;

  const roles = await db.userRole.findMany({
    where: { userId: session.user.id, role: { in: PAID_ROLES } },
    select: {
      role: true,
      verificationStatus: true,
      verificationRejectedReason: true,
    },
    orderBy: { role: "asc" },
  });

  if (roles.length === 0) {
    return (
      <div className="mx-auto flex min-h-full max-w-lg flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <h1 className="text-display-md text-text-primary">
          No provider role yet
        </h1>
        <p className="text-body-md text-text-secondary">
          Add a provider role first, then come back here to verify your
          identity.
        </p>
        <Link
          href="/dashboard/settings/roles"
          className="text-text-link hover:underline"
        >
          Manage roles
        </Link>
      </div>
    );
  }

  const selected = roles.find((r) => r.role === roleParam);

  if (!selected) {
    return (
      <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-5 px-6 py-16">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-display-md text-text-primary">
            Verify your identity
          </h1>
          <p className="text-body-md text-text-secondary">
            Choose which role to verify.
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          {roles.map((r) => (
            <Link
              key={r.role}
              href={`/onboarding/verification?role=${r.role}`}
              className="flex items-center justify-between rounded-[var(--fg-radius-md)] border border-border-default p-4 hover:bg-bg-sunken"
            >
              <span className="text-body-md font-semibold text-text-primary">
                {ROLE_LABELS[r.role]}
              </span>
              <span className="text-body-sm text-text-secondary">
                {STATUS_LABELS[r.verificationStatus]}
              </span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <VerificationForm
      role={selected.role}
      status={selected.verificationStatus}
      rejectedReason={selected.verificationRejectedReason}
    />
  );
}
