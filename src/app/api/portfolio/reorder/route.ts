import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { reorderPortfolioSchema } from "@/lib/validations/portfolio";

export async function PATCH(request: Request) {
  const t = await getTranslations("apiMessages.portfolio");
  try {
    const session = await requireAuth();

    const body = await request.json();
    const parsed = reorderPortfolioSchema.safeParse(body);
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

    const media = await db.profileMedia.findMany({
      where: { id: { in: parsed.data.order } },
      include: { profile: { select: { userId: true } } },
    });

    const allOwnedByUser =
      media.length === parsed.data.order.length &&
      media.every((m) => m.profile.userId === session.user.id);
    if (!allOwnedByUser) {
      return NextResponse.json(
        { data: null, error: "forbidden", message: t("notOwned") },
        { status: 403 },
      );
    }

    await db.$transaction(
      parsed.data.order.map((id, index) =>
        db.profileMedia.update({ where: { id }, data: { order: index } }),
      ),
    );

    return NextResponse.json(
      { data: null, error: null, message: t("orderUpdated") },
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
      { data: null, error: "server_error", message: t("reorderFailed") },
      { status: 500 },
    );
  }
}
