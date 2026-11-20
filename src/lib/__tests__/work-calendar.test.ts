import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  type AgendaItem,
  addDays,
  clashingKeys,
  groupByDay,
  instantToVietnam,
  isDateKey,
  mapsUrl,
  monthWindow,
  sortAgenda,
  telHref,
  vietnamToInstant,
  weekOf,
} from "@/lib/calendar/agenda";
import {
  buildIcs,
  escapeIcsText,
  foldIcsLine,
  googleCalendarUrl,
} from "@/lib/calendar/ics";
import { calendarEntrySchema } from "@/lib/validations/calendar";

function item(over: Partial<AgendaItem>): AgendaItem {
  return {
    id: "a",
    kind: "ENTRY",
    dateKey: "2026-11-25",
    startTime: "09:00",
    endTime: "11:00",
    title: "Chụp cưới",
    status: null,
    customerName: null,
    customerPhone: null,
    address: null,
    notes: null,
    privateNote: null,
    price: null,
    href: null,
    ...over,
  };
}

describe("Vietnam days and times", () => {
  it("turns a local day and time into the instant it names, and back", () => {
    const instant = vietnamToInstant("2026-11-25", "09:00");
    assert.equal(instant.toISOString(), "2026-11-25T02:00:00.000Z");
    assert.deepEqual(instantToVietnam(instant), {
      dateKey: "2026-11-25",
      time: "09:00",
    });
  });

  it("keeps an early-morning job on its Vietnam day, not the UTC one", () => {
    // 05:30 in Vietnam is still the previous day in UTC.
    const instant = vietnamToInstant("2026-11-25", "05:30");
    assert.equal(instant.toISOString(), "2026-11-24T22:30:00.000Z");
    assert.equal(instantToVietnam(instant).dateKey, "2026-11-25");
  });

  it("accepts real dates only", () => {
    assert.equal(isDateKey("2026-11-25"), true);
    assert.equal(isDateKey("2026-02-30"), false);
    assert.equal(isDateKey("25/11/2026"), false);
    assert.equal(isDateKey(null), false);
  });
});

describe("weeks and the month window", () => {
  it("starts the week on Monday", () => {
    // 25/11/2026 is a Wednesday.
    assert.deepEqual(weekOf("2026-11-25"), [
      "2026-11-23",
      "2026-11-24",
      "2026-11-25",
      "2026-11-26",
      "2026-11-27",
      "2026-11-28",
      "2026-11-29",
    ]);
    // A Sunday belongs to the week that began the Monday before.
    assert.equal(weekOf("2026-11-29")[0], "2026-11-23");
  });

  it("widens a month to whole weeks so a week strip is never cut", () => {
    // November 2026 starts on a Sunday and ends on a Monday.
    assert.deepEqual(monthWindow("2026-11-25"), {
      from: "2026-10-26",
      to: "2026-12-07",
    });
    const window = monthWindow("2026-11-01");
    assert.ok(
      weekOf("2026-11-01").every((d) => d >= window.from && d < window.to),
    );
    assert.ok(
      weekOf("2026-11-30").every((d) => d >= window.from && d < window.to),
    );
  });

  it("crosses month and year ends", () => {
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2027-03-01", -1), "2027-02-28");
  });
});

describe("the day's list", () => {
  it("runs in time order, a whole-day item first", () => {
    const sorted = sortAgenda([
      item({ id: "late", startTime: "14:00", endTime: "16:00" }),
      item({ id: "busy", kind: "BLOCK", startTime: null, endTime: null }),
      item({ id: "early", startTime: "08:00", endTime: "09:00" }),
      item({ id: "yesterday", dateKey: "2026-11-24", startTime: "20:00" }),
    ]);
    assert.deepEqual(
      sorted.map((i) => i.id),
      ["yesterday", "busy", "early", "late"],
    );
    assert.deepEqual(
      [...groupByDay(sorted).keys()],
      ["2026-11-24", "2026-11-25"],
    );
  });

  it("flags jobs that share time, but not ones that only touch", () => {
    const a = item({ id: "a", startTime: "09:00", endTime: "11:00" });
    const b = item({
      id: "b",
      kind: "BOOKING",
      startTime: "10:00",
      endTime: "12:00",
    });
    const c = item({ id: "c", startTime: "12:00", endTime: "13:00" });
    const busy = item({
      id: "x",
      kind: "BLOCK",
      startTime: "09:00",
      endTime: "18:00",
    });
    assert.deepEqual([...clashingKeys([a, b, c, busy])].sort(), [
      "BOOKING:b",
      "ENTRY:a",
    ]);
  });

  it("builds links a phone can act on", () => {
    assert.equal(telHref("090 123 4567"), "tel:0901234567");
    assert.equal(telHref("+84 (90) 123-4567"), "tel:+84901234567");
    assert.equal(telHref("gọi sau"), null);
    assert.ok(
      mapsUrl("12 Nguyễn Huệ, Q1").includes("query=12%20Nguy%E1%BB%85n"),
    );
  });
});

describe("what a provider may write into their calendar", () => {
  const base = {
    title: "Chụp cưới",
    date: "2026-11-25",
    startTime: "09:00",
    endTime: "11:00",
  };

  it("takes a job with only a name and a time", () => {
    const parsed = calendarEntrySchema.parse(base);
    assert.equal(parsed.customerPhone ?? null, null);
  });

  it("stores blanks as nothing, not as empty strings", () => {
    const parsed = calendarEntrySchema.parse({
      ...base,
      locationAddress: "  ",
      customerName: "",
      customerPhone: "",
      price: null,
      notes: "",
    });
    assert.equal(parsed.locationAddress, null);
    assert.equal(parsed.customerName, null);
    assert.equal(parsed.customerPhone, null);
    assert.equal(parsed.notes, null);
  });

  it("refuses an end that is not after the start, a blank name, a bad phone", () => {
    const issue = (input: object) =>
      calendarEntrySchema.safeParse({ ...base, ...input }).error?.issues[0]
        ?.message;
    assert.equal(issue({ endTime: "09:00" }), "endBeforeStart");
    assert.equal(issue({ endTime: "08:00" }), "endBeforeStart");
    assert.equal(issue({ title: "   " }), "titleRequired");
    assert.equal(issue({ customerPhone: "abc" }), "phoneInvalid");
    assert.ok(issue({ date: "2026-02-30" }));
    assert.ok(issue({ startTime: "25:00" }));
  });
});

describe("the phone-calendar file", () => {
  const event = {
    uid: "entry-1@fgrapher",
    start: vietnamToInstant("2026-11-25", "09:00"),
    end: vietnamToInstant("2026-11-25", "11:00"),
    summary: "Chụp cưới · Chị Lan",
    location: "12 Nguyễn Huệ, Quận 1; cổng sau",
    description: "Khách: Chị Lan\nMang đèn, phông trắng",
    alarmMinutes: [60],
  };

  it("writes times in UTC and escapes what the format reserves", () => {
    const ics = buildIcs([event], {
      calendarName: "Lịch làm việc Fgrapher",
      now: new Date("2026-11-20T00:00:00.000Z"),
    });
    assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
    assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
    assert.ok(ics.includes("DTSTART:20261125T020000Z"));
    assert.ok(ics.includes("DTEND:20261125T040000Z"));
    assert.ok(ics.includes("LOCATION:12 Nguyễn Huệ\\, Quận 1\\; cổng sau"));
    assert.ok(
      ics.includes("DESCRIPTION:Khách: Chị Lan\\nMang đèn\\, phông trắng"),
    );
    assert.ok(ics.includes("TRIGGER:-PT60M"));
    assert.equal(escapeIcsText("a\\b"), "a\\\\b");
  });

  it("folds long lines by bytes without cutting a Vietnamese letter in two", () => {
    const line = `DESCRIPTION:${"Đường Nguyễn Thị Minh Khai, phường Bến Nghé ".repeat(4)}`;
    const folded = foldIcsLine(line);
    const encoder = new TextEncoder();
    for (const part of folded.split("\r\n")) {
      assert.ok(encoder.encode(part).length <= 75, `${part.length} too long`);
      assert.ok(!part.includes("�"));
    }
    // Unfolding gives the line back exactly.
    assert.equal(folded.split("\r\n ").join(""), line);
  });

  it("offers the same event as a Google Calendar link", () => {
    const url = new URL(googleCalendarUrl(event));
    assert.equal(
      url.searchParams.get("dates"),
      "20261125T020000Z/20261125T040000Z",
    );
    assert.equal(url.searchParams.get("text"), "Chụp cưới · Chị Lan");
  });
});

describe("who may see a provider's own entries", () => {
  const read = (path: string) => readFileSync(path, "utf8");

  it("every entry read and write is scoped to its owner", () => {
    const source = read("src/services/calendar-entries.ts");
    // No lookup by id alone.
    assert.doesNotMatch(source, /calendarEntry\.\w+\(\{\s*where: \{ id \}/);
    for (const call of ["updateMany", "deleteMany", "findFirst"]) {
      assert.match(
        source,
        new RegExp(
          `calendarEntry\\.${call}\\(\\{\\s*where: \\{ id, userId \\}`,
        ),
      );
    }
  });

  it("the availability engines learn an entry's hours and nothing else", () => {
    const source = read("src/services/calendar-entries.ts");
    const fn = source.slice(
      source.indexOf("export async function entryWindowsForProviders"),
    );
    assert.match(fn, /select: \{ userId: true, startAt: true, endAt: true \}/);
    assert.ok(
      read("src/services/availability.ts").includes("entryWindowsForProviders"),
    );
    assert.ok(
      read("src/services/fmap.ts").includes("entryWindowsForProviders"),
    );
  });

  it("entries and private notes are exported with, and erased with, the account", () => {
    const source = read("src/services/compliance.ts");
    assert.match(
      source,
      /db\.calendarEntry\.findMany\(\{\s*where: \{ userId \}/,
    );
    assert.match(
      source,
      /db\.calendarEntry\.deleteMany\(\{ where: \{ userId \} \}\)/,
    );
    assert.match(
      source,
      /db\.bookingNote\.deleteMany\(\{ where: \{ userId \} \}\)/,
    );
    assert.match(source, /calendarFeedToken: null/);
  });

  it("a private note is never part of the booking a customer is handed", () => {
    const bookings = read("src/services/bookings.ts");
    assert.ok(!bookings.includes("privateNotes"));
    assert.ok(!bookings.includes("bookingNote"));
  });
});
