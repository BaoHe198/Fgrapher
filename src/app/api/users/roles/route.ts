import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireAuth, AuthError } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { PAID_ROLES } from "@/lib/constants";
import { updateRolesSchema } from "@/lib/validations/user";
import { assignFreePlan } from "@/services/subscription";

export async function POST(request: Request) {
  const t = await getTranslations("apiMessages.roles");
  try {
    const session = await requireAuth();

    const body = await request.json();
    const parsed = updateRolesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          data: null,
          error: "validation_error",
          message: parsed.error.issues[0]?.message ?? t("invalidInput"),
        },
        { status: 400 },
      );
    }

    // updateRolesSchema can't read the runtime feature flag (it's built at
    // module scope), so CAMERA_SHOP is checked here instead — the roles UI
    // already hides it while MARKETPLACE_ENABLED=false (see CLAUDE.md), but
    // a direct API call could otherwise still grant an active-looking
    // CAMERA_SHOP role and a publishable, searchable profile.
    if (
      !features.marketplaceEnabled &&
      parsed.data.roles.includes("CAMERA_SHOP")
    ) {
      return NextResponse.json(
        {
          data: null,
          error: "validation_error",
          message: t("invalidRole"),
        },
        { status: 400 },
      );
    }

    // MVP scope decision — one provider role per account. parsed.data.roles
    // is already capped to at most 1 by the schema, but that alone doesn't
    // catch the self-service "add a role" flow: it sends just the one new
    // role, while an existing active role (if any) lives only in the DB,
    // never in this request. Check both together.
    const requestedPaidRole = parsed.data.roles[0] as string | undefined;
    if (requestedPaidRole) {
      const existingActivePaidRole = await db.userRole.findFirst({
        where: {
          userId: session.user.id,
          active: true,
          role: {
            in: PAID_ROLES,
            not: requestedPaidRole as (typeof PAID_ROLES)[number],
          },
        },
        select: { role: true },
      });
      if (existingActivePaidRole) {
        return NextResponse.json(
          {
            data: null,
            error: "validation_error",
            message: t("onlyOneProviderRole"),
          },
          { status: 400 },
        );
      }
    }

    // CUSTOMER is always active, regardless of what the client sends.
    const roles = Array.from(
      new Set([...parsed.data.roles, "CUSTOMER" as const]),
    );

    const userRoles = await db.$transaction(
      roles.map((role) =>
        db.userRole.upsert({
          where: { userId_role: { userId: session.user.id, role } },
          create: { userId: session.user.id, role, active: true },
          update: { active: true },
        }),
      ),
    );

    // Mirrors /api/auth/register's own assignFreePlan call (CLAUDE.md's
    // Stripe ban — no VN merchant account, so BILLING_ENABLED=false and
    // plans go out free instead of through Checkout). Registration was
    // the only place this ran, so activating a paid role afterward
    // through this route left it with an `active` UserRole but no
    // Subscription row at all — permanently blocked by every
    // subscription-gated feature (SubscriptionGate, requirePaidRole),
    // with no admin action expected to unblock it.
    const paidRoles = roles.filter((role) =>
      (PAID_ROLES as string[]).includes(role),
    );
    if (!features.billingEnabled && paidRoles.length > 0) {
      await assignFreePlan(session.user.id, paidRoles);
    }

    return NextResponse.json(
      {
        data: { roles: userRoles.map((r) => r.role) },
        error: null,
        message: t("saved"),
      },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: t("saveFailed") },
      { status: 500 },
    );
  }
}
