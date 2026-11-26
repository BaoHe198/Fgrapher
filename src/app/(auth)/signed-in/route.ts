import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

// Where a sign-in lands when the visitor was not on their way somewhere
// (no callbackUrl). An admin goes to the admin panel: they used to land on
// the ordinary dashboard and had to find the way in (role walk-through,
// 25/11/2026). Everyone else goes to the dashboard as before.
//
// A stop on the way, not a page: "Thoát quản trị" still opens /dashboard for
// an admin, because only a fresh sign-in passes through here.
export async function GET(request: Request) {
  const session = await auth();
  const target = !session?.user
    ? "/login"
    : session.user.roles.includes("ADMIN")
      ? "/admin"
      : "/dashboard";
  return NextResponse.redirect(new URL(target, request.url));
}
