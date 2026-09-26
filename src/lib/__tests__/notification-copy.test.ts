import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import vi from "@/messages/vi.json";
import en from "@/messages/en.json";

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === "__tests__" ? [] : sources(path);
    }
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

// A notification is stored as text and shown as-is in the bell, so a
// hardcoded English title reached Vietnamese users ("Someone liked your
// post"). Every title, message and email subject handed to notify() must
// come from the message catalog.
describe("notification copy", () => {
  it("no notify() call hardcodes its title, message or email subject", () => {
    const offenders: string[] = [];
    let calls = 0;
    for (const file of sources("src")) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/\bnotify\(\{/g)) {
        calls++;
        // The fields sit within the first few hundred characters of the call.
        const body = text.slice(m.index, m.index + 700);
        const end = body.indexOf("\n  });");
        const call = end === -1 ? body : body.slice(0, end);
        for (const field of call.matchAll(
          /\b(title|message|subject):\s*(["'`])/g,
        )) {
          const line = text.slice(0, m.index).split("\n").length;
          offenders.push(`${file}:${line} ${field[1]}`);
        }
      }
    }
    assert.ok(calls > 20, "found the notify() calls");
    assert.deepEqual(offenders, []);
  });

  it("post and order notification keys exist in both languages", () => {
    for (const catalog of [vi, en]) {
      const n = catalog.libServices.notifications;
      assert.ok(n.post.like.title && n.post.comment.title);
      for (const status of [
        "PENDING",
        "CONFIRMED",
        "SHIPPED",
        "DELIVERED",
        "PICKED_UP",
        "OVERDUE",
        "CANCELLED",
        "RETURNED",
      ] as const) {
        assert.ok(n.order.statusLabel[status], `statusLabel.${status}`);
      }
    }
  });
});
