import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { createServiceRequestSchema } from "@/lib/validations/service-request";
import {
  ServiceRequestError,
  createServiceRequest,
  listCustomerRequests,
} from "@/services/service-requests";

export async function GET() {
  const t = await getTranslations("apiMessages.serviceRequests");
  try {
    const session = await requireAuth();
    const requests = await listCustomerRequests(session.user.id);
    return NextResponse.json(
      { data: requests, error: null, message: null },
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
      { data: null, error: "server_error", message: t("loadFailed") },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const t = await getTranslations("apiMessages.serviceRequests");
  try {
    const session = await requireAuth();

    const body = await request.json();
    const parsed = createServiceRequestSchema.safeParse(body);
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

    const created = await createServiceRequest(session.user.id, parsed.data);

    return NextResponse.json(
      { data: created, error: null, message: t("created") },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    if (err instanceof ServiceRequestError) {
      return NextResponse.json(
        { data: null, error: "request_error", message: err.message },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { data: null, error: "server_error", message: t("createFailed") },
      { status: 500 },
    );
  }
}
