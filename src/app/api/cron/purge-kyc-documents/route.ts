import { NextResponse } from "next/server";

import { purgeExpiredKycDocuments } from "@/services/verification";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json(
      { data: null, error: "unauthorized", message: null },
      { status: 401 },
    );
  }

  const purgedCount = await purgeExpiredKycDocuments();

  return NextResponse.json(
    { data: { purgedCount }, error: null, message: null },
    { status: 200 },
  );
}
