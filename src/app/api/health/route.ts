import { NextResponse } from "next/server";

import { db } from "@/lib/db";

// Public, unauthenticated, unrate-limited by design — this is what an
// uptime monitor (or a load balancer health probe) hits every 30-60s.
// No i18n: the response is machine-consumed only, never rendered to a
// user (same exception already made for search.ts's rate-limit message).
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch {
    return NextResponse.json(
      { status: "error", reason: "database_unreachable" },
      { status: 503 },
    );
  }
}
