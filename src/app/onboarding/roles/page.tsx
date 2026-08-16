import { redirect } from "next/navigation";

import { RoleSelectionForm } from "@/components/forms/role-selection-form";
import { auth } from "@/lib/auth";

export default async function OnboardingRolesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col justify-center px-6 py-16">
      <div className="space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            How will you use Fgrapher?
          </h1>
          <p className="mx-auto max-w-lg text-muted-foreground">
            Pick every role that fits — you can always add more later. Customer
            is included by default so you can always book and browse.
          </p>
        </div>

        <RoleSelectionForm />
      </div>
    </div>
  );
}
