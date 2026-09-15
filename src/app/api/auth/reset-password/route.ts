import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { completePasswordReset } from "@/services/password-reset";

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Missing reset token"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: Request) {
  const t = await getTranslations("apiMessages.auth");
  const body = await request.json();
  const parsed = resetPasswordSchema.safeParse(body);

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

  const { token, password } = parsed.data;
  const result = await completePasswordReset({ rawToken: token, password });

  if (result.status === "invalid") {
    return NextResponse.json(
      {
        data: null,
        error: "invalid_token",
        message: t("resetLinkInvalid"),
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { data: null, error: null, message: t("passwordUpdated") },
    { status: 200 },
  );
}
