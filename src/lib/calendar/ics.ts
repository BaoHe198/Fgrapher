/**
 * iCalendar (RFC 5545) text for the provider's schedule: one event to add
 * to a phone by hand, or the whole calendar for a phone to subscribe to.
 *
 * Kept free of any database or request type so it can be tested as text.
 * Times are written in UTC ("…Z"), which every calendar app converts to the
 * phone's own zone; nothing here depends on a VTIMEZONE block being
 * understood.
 */
export interface IcsEvent {
  /** Stable across regenerations — a changed UID is a duplicate event. */
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  location?: string | null;
  description?: string | null;
  url?: string | null;
  /** TENTATIVE for a booking still waiting for the provider's answer. */
  status?: "CONFIRMED" | "TENTATIVE";
  lastModified?: Date | null;
  /** Minutes before the start at which the phone should alert. */
  alarmMinutes?: number[];
}

const CRLF = "\r\n";

function stamp(date: Date) {
  return `${date.toISOString().slice(0, 19).replace(/[-:]/g, "")}Z`;
}

/** TEXT value escaping (RFC 5545 §3.3.11). */
export function escapeIcsText(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Content lines may not exceed 75 octets; longer ones continue on the next
 * line after a single space. Counted in UTF-8 bytes and never split inside
 * a character — Vietnamese text is mostly two- and three-byte characters,
 * and a line cut mid-character arrives as "�" in the calendar app.
 */
export function foldIcsLine(line: string) {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  // The first line may use 75 octets; continuations give one to the space.
  let limit = 75;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (currentBytes + size > limit) {
      parts.push(current);
      current = "";
      currentBytes = 0;
      limit = 74;
    }
    current += char;
    currentBytes += size;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

function eventLines(event: IcsEvent, now: Date) {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(event.start)}`,
    `DTEND:${stamp(event.end)}`,
    `SUMMARY:${escapeIcsText(event.summary)}`,
  ];
  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  }
  if (event.url) lines.push(`URL:${event.url}`);
  if (event.status) lines.push(`STATUS:${event.status}`);
  if (event.lastModified) {
    lines.push(`LAST-MODIFIED:${stamp(event.lastModified)}`);
    // Revision number: must grow with every change. Seconds since 2020
    // does, and fits the 32-bit integer some calendar apps store it in.
    lines.push(
      `SEQUENCE:${Math.max(0, Math.floor((event.lastModified.getTime() - Date.UTC(2020, 0, 1)) / 1000))}`,
    );
  }
  for (const minutes of event.alarmMinutes ?? []) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcsText(event.summary)}`,
      `TRIGGER:-PT${minutes}M`,
      "END:VALARM",
    );
  }
  lines.push("END:VEVENT");
  return lines;
}

export function buildIcs(
  events: IcsEvent[],
  options: { calendarName: string; now?: Date },
) {
  const now = options.now ?? new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Fgrapher//Lich lam viec//VI",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(options.calendarName)}`,
    "X-WR-TIMEZONE:Asia/Ho_Chi_Minh",
    // How often a subscribed calendar should look again. Apple honours it;
    // Google Calendar refreshes on its own schedule regardless.
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...events.flatMap((event) => eventLines(event, now)),
    "END:VCALENDAR",
  ];
  return lines.map(foldIcsLine).join(CRLF) + CRLF;
}

/**
 * A link that opens Google Calendar's "new event" form already filled in —
 * on Android it opens the app itself, which is the quickest way to get one
 * job into the phone with its alarm.
 */
export function googleCalendarUrl(
  event: Pick<
    IcsEvent,
    "start" | "end" | "summary" | "location" | "description"
  >,
) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.summary,
    dates: `${stamp(event.start)}/${stamp(event.end)}`,
  });
  if (event.location) params.set("location", event.location);
  if (event.description) params.set("details", event.description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
