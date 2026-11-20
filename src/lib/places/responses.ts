import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import type { z } from "zod";

import { AuthError } from "@/lib/auth-helpers";
import { PlaceError } from "@/services/places";

// The JSON every photo-spot route answers with on failure, in the shape the
// API conventions ask for ({ data, error, message }). Kept in one place so
// the provider routes and the admin routes say the same thing for the same
// problem.

export async function placeFailure(err: unknown, fallbackKey = "saveFailed") {
  const t = await getTranslations("apiMessages.places");
  if (err instanceof AuthError) {
    return NextResponse.json(
      { data: null, error: "unauthorized", message: err.message },
      { status: err.status },
    );
  }
  if (err instanceof PlaceError) {
    return NextResponse.json(
      {
        data: err.code === "duplicate" ? { nearby: err.nearby } : null,
        error: err.code,
        message: t(`errors.${err.code}`),
      },
      { status: err.status },
    );
  }
  console.error("[Places] Request failed", err);
  return NextResponse.json(
    { data: null, error: "server_error", message: t(fallbackKey) },
    { status: 500 },
  );
}

export async function placeInvalid(error: z.ZodError) {
  const t = await getTranslations("apiMessages.places");
  return NextResponse.json(
    {
      data: { fields: error.issues.map((issue) => issue.path.join(".")) },
      error: "validation_error",
      message: t("invalidInput"),
    },
    { status: 400 },
  );
}
