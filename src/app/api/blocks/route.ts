import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { blockUserSchema } from "@/lib/validations/message";
import {
  blockUser,
  hasBlocked,
  MessagingError,
  unblockUser,
} from "@/services/messaging";

// Whether the signed-in user has blocked `userId`. The chat needs it to offer
// "Bỏ chặn" — a block used to be invisible once made, and permanent, because
// nothing in the app could show or undo it.
export async function GET(request: Request) {
  const t = await getTranslations("apiMessages.blocks");
  try {
    const session = await requireAuth();
    const userId = new URL(request.url).searchParams.get("userId");
    if (!userId) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: t("userIdRequired") },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        data: { blocked: await hasBlocked(session.user.id, userId) },
        error: null,
        message: null,
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
      { data: null, error: "server_error", message: t("blockFailed") },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const t = await getTranslations("apiMessages.blocks");
  try {
    const session = await requireAuth();
    const body = await request.json();
    const parsed = blockUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: t("userIdRequired") },
        { status: 400 },
      );
    }

    await blockUser(session.user.id, parsed.data.userId, parsed.data.reason);

    return NextResponse.json(
      { data: null, error: null, message: t("blocked") },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    if (err instanceof MessagingError) {
      return NextResponse.json(
        { data: null, error: "messaging_error", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: t("blockFailed") },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const t = await getTranslations("apiMessages.blocks");
  try {
    const session = await requireAuth();
    const body = await request.json();
    const parsed = blockUserSchema.pick({ userId: true }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: t("userIdRequired") },
        { status: 400 },
      );
    }

    await unblockUser(session.user.id, parsed.data.userId);

    return NextResponse.json(
      { data: null, error: null, message: t("unblocked") },
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
      { data: null, error: "server_error", message: t("unblockFailed") },
      { status: 500 },
    );
  }
}
