import { NextResponse } from "next/server";

import { lookUpVimeo } from "@/lib/media/vimeo";

// The poster frame of a linked Vimeo video. Vimeo has no thumbnail address
// that can be worked out from a video's id (YouTube has), so a grid tile
// asks here and is redirected to the image on Vimeo's own image host.
//
// Public, like the thumbnails themselves. It only ever redirects to
// *.vimeocdn.com (lib/media/vimeo.ts checks), so it cannot be used to send
// a browser anywhere else, and the lookup behind it is cached for a day.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const hash = new URL(request.url).searchParams.get("h");
  const found = await lookUpVimeo(id, hash);

  if (found.status !== "ok" || !found.thumbnailUrl) {
    // The tile draws a plain placeholder. Cached briefly, so a video that
    // comes back, or a lookup that failed, is asked about again soon.
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "public, max-age=300" },
    });
  }
  return NextResponse.redirect(found.thumbnailUrl, {
    status: 302,
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}
