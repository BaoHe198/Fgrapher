import { permanentRedirect } from "next/navigation";

// A provider's own link (/p/<username>), the one on their TikTok bio, Zalo
// chat or printed QR card. It used to render its own five-step page; since
// the profile itself became an Airbnb-style booking page (owner,
// 17/11/2026) there is one page with two doors, and this door just opens it.
// Chat apps follow the redirect and read the profile's preview tags, which
// carry the price, rating and verified badge.
interface LinkPageProps {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ role?: string }>;
}

export default async function LinkPage({
  params,
  searchParams,
}: LinkPageProps) {
  const { username } = await params;
  const { role } = await searchParams;
  const query = role ? `?role=${encodeURIComponent(role)}` : "";
  permanentRedirect(`/profile/${encodeURIComponent(username)}${query}`);
}
