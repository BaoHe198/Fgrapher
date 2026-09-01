import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireAuth, AuthError } from "@/lib/auth-helpers";
import { createRoleChangeRequestSchema } from "@/lib/validations/user";
import {
  createRoleChangeRequest,
  RoleChangeRequestError,
} from "@/services/role-change-requests";

const ERROR_MESSAGE_KEY: Record<string, string> = {
  invalid_role: "invalidRole",
  no_active_role: "changeRequestNoActiveRole",
  not_verified: "changeRequestNotVerified",
  same_role: "changeRequestSameRole",
  already_pending: "changeRequestAlreadyPending",
};

export async function POST(request: Request) {
  const t = await getTranslations("apiMessages.roles");
  try {
    const session = await requireAuth();

    const body = await request.json();
    const parsed = createRoleChangeRequestSchema.safeParse(body);
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

    const roleChangeRequest = await createRoleChangeRequest(
      session.user.id,
      parsed.data.toRole,
      parsed.data.reason,
    );

    return NextResponse.json(
      {
        data: roleChangeRequest,
        error: null,
        message: t("changeRequestSubmitted"),
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    if (err instanceof RoleChangeRequestError) {
      const key = ERROR_MESSAGE_KEY[err.message] ?? "changeRequestFailed";
      return NextResponse.json(
        { data: null, error: err.message, message: t(key) },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: t("changeRequestFailed") },
      { status: 500 },
    );
  }
}
