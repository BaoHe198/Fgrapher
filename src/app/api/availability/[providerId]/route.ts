import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getProviderAvailability } from "@/services/availability";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ providerId: string }> },
) {
  const { providerId } = await params;
  const { searchParams } = new URL(request.url);
  const serviceId = searchParams.get("serviceId");

  // `from`/`to` are plain "YYYY-MM-DD" calendar-date keys (the caller's
  // local "today", not a UTC instant) — anchor to UTC midnight for that
  // date so they line up with getProviderAvailability's UTC-based model
  // and Postgres's own `@db.Date` normalization.
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const todayKey = new Date().toISOString().slice(0, 10);
  const from = new Date(`${fromParam ?? todayKey}T00:00:00.000Z`);

  const days = toParam
    ? Math.max(
        1,
        Math.ceil(
          (new Date(`${toParam}T00:00:00.000Z`).getTime() - from.getTime()) / 86_400_000,
        ),
      )
    : 7;

  const service = serviceId
    ? await db.service.findUnique({ where: { id: serviceId }, select: { duration: true } })
    : null;

  const dates = await getProviderAvailability(providerId, from, days, service?.duration);

  return NextResponse.json(
    { data: { dates }, error: null, message: null },
    { status: 200, headers: { "Cache-Control": "public, max-age=0, s-maxage=60" } },
  );
}
