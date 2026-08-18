import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Missing reset token"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = resetPasswordSchema.safeParse(body);

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

  const { token, password } = parsed.data;
  const record = await db.verificationToken.findUnique({ where: { token } });

  if (!record || record.expires < new Date()) {
    return NextResponse.json(
      {
        data: null,
        error: "invalid_token",
        message: "This reset link is invalid or has expired",
      },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db.$transaction([
    db.user.update({ where: { email: record.identifier }, data: { passwordHash } }),
    db.verificationToken.delete({ where: { token } }),
  ]);

  return NextResponse.json(
    { data: null, error: null, message: "Password updated" },
    { status: 200 },
  );
}
