import { getTranslations } from "next-intl/server";
import { NextResponse } from "next/server";

import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getDarkroomPrint } from "@/services/search";

// One random public photo for the home page's darkroom. No auth: it serves
// only what Tìm kiếm F already shows anyone (services/search.ts
// getDarkroomPrint applies the same public rules). `exclude` is the list
// of photo ids this visitor has already developed.
const MAX_EXCLUDE = 40;
const ID_PATTERN = /^[a-z0-9]{1,40}$/i;

export async function GET(request: Request) {
  const t = await getTranslations("apiMessages.darkroom");
  try {
    const limit = checkRateLimit(`darkroom:${getClientIp(request)}`, {
      max: 40,
      windowMs: 60_000,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { data: null, error: "rate_limited", message: t("tooMany") },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSeconds) },
        },
      );
    }

    const exclude = (new URL(request.url).searchParams.get("exclude") ?? "")
      .split(",")
      .filter((id) => ID_PATTERN.test(id))
      .slice(-MAX_EXCLUDE);

    const print = await getDarkroomPrint(exclude);
    return NextResponse.json(
      { data: print, error: null, message: null },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { data: null, error: "server_error", message: t("loadFailed") },
      { status: 500 },
    );
  }
}
