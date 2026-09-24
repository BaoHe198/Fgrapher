import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

// A reworded Vietnamese string once renamed its own `{provider}` argument
// ("{nhà cung cấp}") and the review-reminder banner rendered its raw key on
// every dashboard page. Both catalogs must name the same ICU arguments.

const root = path.resolve(__dirname, "../../..");
const load = (lang: string) =>
  JSON.parse(
    readFileSync(path.join(root, `src/messages/${lang}.json`), "utf8"),
  ) as Record<string, unknown>;

/** Argument names of an ICU message; plural/select branch text is skipped. */
function argumentNames(message: string): Set<string> {
  const names = new Set<string>();
  let i = 0;

  const skipQuoted = () => {
    const end = message.indexOf("'", i + 1);
    i = end === -1 ? message.length : end + 1;
  };

  // Reads message text until the "}" that closes the enclosing block.
  const readMessage = () => {
    while (i < message.length) {
      const c = message[i];
      // ICU quotes only an apostrophe that precedes a syntax character;
      // the one in "can't" or "you'll" is plain text.
      if (c === "'" && "{}#|".includes(message[i + 1] ?? "")) skipQuoted();
      else if (c === "{") {
        i++;
        readArgument();
      } else if (c === "}") return;
      else i++;
    }
  };

  const readArgument = () => {
    const nameMatch = /^\s*([^\s,{}]+)\s*/.exec(message.slice(i));
    if (!nameMatch) return;
    names.add(nameMatch[1]);
    i += nameMatch[0].length;
    if (message[i] === "}") {
      i++;
      return;
    }
    i++; // ","
    const typeMatch = /^\s*([a-zA-Z]+)\s*/.exec(message.slice(i));
    const type = typeMatch?.[1] ?? "";
    i += typeMatch?.[0].length ?? 0;
    if (!["plural", "select", "selectordinal"].includes(type)) {
      let depth = 1;
      while (i < message.length && depth > 0) {
        if (message[i] === "{") depth++;
        if (message[i] === "}") depth--;
        i++;
      }
      return;
    }
    i++; // "," after the type
    while (i < message.length && message[i] !== "}") {
      const open = message.indexOf("{", i);
      const close = message.indexOf("}", i);
      if (open === -1 || (close !== -1 && close < open)) {
        i = close === -1 ? message.length : close;
        break;
      }
      i = open + 1;
      readMessage();
      i++; // branch "}"
    }
    i++; // argument "}"
  };

  readMessage();
  return names;
}

function mismatches(
  vi: unknown,
  en: unknown,
  at: string,
  out: string[],
): string[] {
  if (typeof vi === "string" && typeof en === "string") {
    const a = [...argumentNames(vi)].sort().join(",");
    const b = [...argumentNames(en)].sort().join(",");
    if (a !== b) out.push(`${at}: vi {${a}} vs en {${b}}`);
  } else if (vi && en && typeof vi === "object" && typeof en === "object") {
    for (const [key, value] of Object.entries(vi)) {
      if (key in en) {
        mismatches(
          value,
          (en as Record<string, unknown>)[key],
          `${at}.${key}`,
          out,
        );
      }
    }
  }
  return out;
}

describe("translation catalogs", () => {
  it("parses plural branches without mistaking their text for arguments", () => {
    assert.deepEqual(
      [
        ...argumentNames(
          "{count, plural, one {# photo was} other {# photos were}} in {album}",
        ),
      ],
      ["count", "album"],
    );
  });

  it("vi and en name the same arguments in every message", () => {
    assert.deepEqual(mismatches(load("vi"), load("en"), "", []), []);
  });
});
