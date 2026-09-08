"use client";

import { ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { signOut } from "next-auth/react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Rendered in place of the whole dashboard layout when the server-side
// check in (dashboard)/layout.tsx finds a session whose account is now
// suspended/soft-deleted — the JWT cookie itself is still technically
// valid (no server-side revocation list, see auth-helpers.ts's
// requireAuth comment), so simply calling redirect("/login") from that
// Server Component doesn't actually end the session: src/proxy.ts's edge
// middleware decodes the same still-valid token and immediately bounces
// an authenticated-looking request straight back out of /login, an
// infinite loop (confirmed in testing — a real browser hits
// ERR_TOO_MANY_REDIRECTS). signOut() here is the real fix: it's a
// client-side POST to NextAuth's own signout endpoint that actually
// clears the cookie before navigating anywhere, so by the time the
// browser lands on /login there's no token left for the middleware to
// act on. Auto-triggered on mount so this resolves itself without
// requiring the click; the button is a visible fallback in case JS is
// slow to run or the user has already dismissed/ignored the auto-redirect.
export function SuspendedAccountNotice() {
  const t = useTranslations("sharedComponents.suspendedAccountNotice");

  useEffect(() => {
    void signOut({ callbackUrl: "/login" });
  }, []);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Card className="flex max-w-md flex-col items-center gap-3 py-10">
        <ShieldAlert className="size-10 text-danger" />
        <h1 className="text-heading-lg text-text-primary">{t("title")}</h1>
        <p className="text-body-md text-text-secondary">{t("body")}</p>
        <Button
          variant="accent"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          {t("signOut")}
        </Button>
      </Card>
    </div>
  );
}
