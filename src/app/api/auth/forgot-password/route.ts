import crypto from "crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { resetPasswordEmailHtml, sendEmail } from "@/lib/email";

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = forgotPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: "validation_error",
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      },
      { status: 400 },
    );
  }

  const { email } = parsed.data;
  const user = await db.user.findUnique({ where: { email } });

  // Always report success, even if no account exists, so this endpoint
  // can't be used to enumerate registered emails.
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await db.verificationToken.deleteMany({ where: { identifier: email } });
    await db.verificationToken.create({ data: { identifier: email, token, expires } });

    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;
    await sendEmail({
      to: email,
      subject: "Reset your Fgrapher password",
      html: resetPasswordEmailHtml({ resetUrl }),
    });
  }

  return NextResponse.json(
    {
      data: null,
      error: null,
      message: "If an account exists for that email, a reset link has been sent",
    },
    { status: 200 },
  );
}
