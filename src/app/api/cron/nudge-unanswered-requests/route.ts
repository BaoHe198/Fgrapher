import { NextResponse } from "next/server";

import { AuthError, requireCronSecret } from "@/lib/auth-helpers";
import { nudgeUnansweredRequests } from "@/services/service-requests";

export async function GET(request: Request) {
  try {
    requireCronSecret(request);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    throw err;
  }

  const result = await nudgeUnansweredRequests();

  return NextResponse.json(
    { data: result, error: null, message: null },
    { status: 200 },
  );
}
