import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { startConversationSchema } from "@/lib/validations/message";
import {
  getOrCreateConversation,
  listConversations,
  MessagingError,
} from "@/services/messaging";

export async function GET(request: Request) {
  const t = await getTranslations("apiMessages.conversations");
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);

    const conversations = await listConversations(session.user.id, page);

    return NextResponse.json(
      { data: conversations, error: null, message: null },
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
  const t = await getTranslations("apiMessages.conversations");
  try {
    const session = await requireAuth();
    const body = await request.json();
    const parsed = startConversationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: t("userIdRequired") },
        { status: 400 },
      );
    }

    const conversationId = await getOrCreateConversation(
      session.user.id,
      parsed.data.userId,
    );

    return NextResponse.json(
      { data: { id: conversationId }, error: null, message: null },
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
      { data: null, error: "server_error", message: t("startFailed") },
      { status: 500 },
    );
  }
}
