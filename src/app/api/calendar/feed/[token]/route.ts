import { calendarFeedIcs } from "@/services/work-calendar";

/**
 * The calendar subscription itself. Google Calendar, Apple Calendar and the
 * like fetch this address on their own schedule with no cookie, so the
 * unguessable token in the path is the whole of the authorisation (see
 * User.calendarFeedToken). An unknown, replaced or switched-off token gets
 * a plain 404 that says nothing about why.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const ics = await calendarFeedIcs(token).catch(() => null);
  if (!ics) return new Response("Not found", { status: 404 });

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="fgrapher.ics"',
      // Private data behind a capability URL: no shared cache may keep it,
      // and no crawler should list it.
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
