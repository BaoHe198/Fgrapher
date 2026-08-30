import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { updateDraftServiceRequestSchema } from "@/lib/validations/service-request";
import {
  ServiceRequestError,
  cancelServiceRequest,
  getServiceRequestForCustomer,
  updateDraftServiceRequest,
} from "@/services/service-requests";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.serviceRequests");
  try {
    const session = await requireAuth();
    const { id } = await params;
    const detail = await getServiceRequestForCustomer(id, session.user.id);
    return NextResponse.json(
      { data: detail, error: null, message: null },
      { status: 200 },
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
      { data: null, error: "server_error", message: t("loadFailed") },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.serviceRequests");
  try {
    const session = await requireAuth();
    const { id } = await params;

    const body = await request.json();
    const parsed = updateDraftServiceRequestSchema.safeParse(body);
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

    const updated = await updateDraftServiceRequest(
      id,
      session.user.id,
      parsed.data,
    );

    return NextResponse.json(
      { data: updated, error: null, message: t("saved") },
      { status: 200 },
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
      { data: null, error: "server_error", message: t("saveFailed") },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.serviceRequests");
  try {
    const session = await requireAuth();
    const { id } = await params;
    await cancelServiceRequest(id, session.user.id);
    return NextResponse.json(
      { data: null, error: null, message: t("cancelled") },
      { status: 200 },
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
      { data: null, error: "server_error", message: t("cancelFailed") },
      { status: 500 },
    );
  }
}
