import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { db } from "@/lib/db";
import { createWaitlistEntrySchema } from "@/lib/validations/waitlist";

// Prompt B4, VIỆC 4 — /browse's empty state for a thin province+role
// search offers this instead of nothing. No auth required (matching
// /api/contact's pattern) — a visitor doesn't need an account to ask to be
// notified.
export async function POST(request: Request) {
  const t = await getTranslations("apiMessages.waitlist");
  const body = await request.json().catch(() => null);
  const parsed = createWaitlistEntrySchema.safeParse(body);

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

  const province = await db.province.findUnique({
    where: { id: parsed.data.provinceId },
    select: { id: true },
  });
  if (!province) {
    return NextResponse.json(
      { data: null, error: "invalid_province", message: t("invalidInput") },
      { status: 400 },
    );
  }

  // One entry per address, area and role. Pressing the button twice (or
  // coming back a week later) used to add a second row, and each row is one
  // more copy of the same "a provider has arrived" email. The answer is the
  // same either way, so the form does not reveal who is already on the list.
  const email = parsed.data.email.trim().toLowerCase();
  const existing = await db.waitlistEntry.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      provinceId: parsed.data.provinceId,
      role: parsed.data.role,
    },
    select: { id: true },
  });
  if (!existing) {
    await db.waitlistEntry.create({
      data: {
        email,
        provinceId: parsed.data.provinceId,
        role: parsed.data.role,
      },
    });
  }

  return NextResponse.json(
    { data: null, error: null, message: t("added") },
    { status: 201 },
  );
}
