import { redirect } from "next/navigation";

interface RegisterRedirectProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

// /register now lives at /login?mode=register (a single combined auth page
// with a tab switcher — see auth-tabs.tsx). This route stays real (not
// deleted) so existing bookmarks/links, and any external links pointing at
// /register, keep working — it just forwards straight through, carrying
// every query param (role, interval, callbackUrl, ...) along with it.
export default async function RegisterRedirectPage({ searchParams }: RegisterRedirectProps) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, value);
  }
  query.set("mode", "register");
  redirect(`/login?${query.toString()}`);
}
