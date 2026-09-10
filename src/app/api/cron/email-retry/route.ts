import { NextResponse } from "next/server";

import {
  processEmailOutbox,
  getEmailOutboxStats,
} from "@/services/email-outbox";

export const runtime = "nodejs";
export const maxDuration = 60;

function verifyCronSecret(request: Request): boolean {
  const secret = request.headers.get("x-cron-secret");
  if (!secret) return false;
  return secret === process.env.CRON_SECRET;
}

export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await processEmailOutbox();
    const stats = await getEmailOutboxStats();
    return NextResponse.json(
      {
        success: true,
        message: "Email retry cron completed",
        stats,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (process.env.NODE_ENV === "production") {
      console.error("[Email Retry Cron] Error", { message });
    }
    return NextResponse.json(
      { error: "Failed to process email outbox", message },
      { status: 500 },
    );
  }
}
