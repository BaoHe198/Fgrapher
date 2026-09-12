import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";

import {
  commitFromDisplay,
  daysInMonth,
  displayToIso,
  isoToDisplay,
  maskDateInput,
} from "@/lib/date-input";

describe("isoToDisplay", () => {
  it("puts the day first, always", () => {
    // The entire reason DateField exists: a native date input would render
    // this same value as 09/13/2026 on an English-language browser.
    assert.equal(isoToDisplay("2026-09-13"), "13/09/2026");
  });

  it("keeps the leading zeros", () => {
    assert.equal(isoToDisplay("2026-01-05"), "05/01/2026");
  });

  it("ignores a time suffix", () => {
    assert.equal(isoToDisplay("2026-09-13T10:00:00.000Z"), "13/09/2026");
  });

  it("treats empty and malformed input as empty", () => {
    for (const raw of ["", undefined, null, "not a date", "2026-9-3"]) {
      assert.equal(isoToDisplay(raw), "");
    }
  });
});

describe("displayToIso", () => {
  it("round-trips with isoToDisplay", () => {
    for (const iso of ["2026-09-13", "2000-02-29", "1999-12-31"]) {
      assert.equal(displayToIso(isoToDisplay(iso)), iso);
    }
  });

  it("rejects days that month does not have", () => {
    assert.equal(displayToIso("31/02/2026"), null);
    assert.equal(displayToIso("31/04/2026"), null);
    assert.equal(displayToIso("29/02/2026"), null);
  });

  it("accepts 29 February in a leap year", () => {
    assert.equal(displayToIso("29/02/2024"), "2024-02-29");
    // 2000 is a leap year, 1900 is not — the rule people get wrong.
    assert.equal(displayToIso("29/02/2000"), "2000-02-29");
    assert.equal(displayToIso("29/02/1900"), null);
  });

  it("rejects impossible months and zero days", () => {
    assert.equal(displayToIso("13/13/2026"), null);
    assert.equal(displayToIso("00/09/2026"), null);
    assert.equal(displayToIso("13/00/2026"), null);
  });

  it("rejects anything that is not a full dd/mm/yyyy", () => {
    for (const raw of ["", "13/09", "13/09/26", "1/9/2026", "13-09-2026"]) {
      assert.equal(displayToIso(raw), null);
    }
  });
});

describe("maskDateInput", () => {
  it("adds the separators as the user types digits", () => {
    const keystrokes = ["1", "13", "130", "1309", "13092", "13092026"];
    const seen = keystrokes.map((raw) => maskDateInput(raw));
    assert.deepEqual(seen, [
      "1",
      "13/",
      "13/0",
      "13/09/",
      "13/09/2",
      "13/09/2026",
    ]);
  });

  it("survives a paste that already has separators", () => {
    assert.equal(maskDateInput("13/09/2026"), "13/09/2026");
    assert.equal(maskDateInput("13-09-2026"), "13/09/2026");
  });

  it("never accepts a ninth digit", () => {
    assert.equal(maskDateInput("130920261"), "13/09/2026");
  });

  it("lets backspace get past a separator instead of re-adding it", () => {
    // Without the isDeleting flag the field sticks at "13/09/" forever.
    assert.equal(maskDateInput("13/09", true), "13/09");
    assert.equal(maskDateInput("13", true), "13");
    assert.equal(maskDateInput("", true), "");
  });
});

describe("commitFromDisplay", () => {
  it("commits a complete valid date", () => {
    assert.equal(commitFromDisplay("13/09/2026"), "2026-09-13");
  });

  it("commits empty when the field is cleared", () => {
    assert.equal(commitFromDisplay(""), "");
  });

  it("commits nothing mid-typing", () => {
    // Otherwise the parent would see 01/01/0002 while the year is typed.
    for (const raw of ["1", "13/", "13/09/", "13/09/2", "13/09/20"]) {
      assert.equal(commitFromDisplay(raw), null);
    }
  });

  it("commits nothing for a date that does not exist", () => {
    assert.equal(commitFromDisplay("31/02/2026"), null);
  });
});

describe("no screen falls back to a native date input", () => {
  it('only DateField itself contains type="date"', () => {
    // A native date input formats its text in the browser's UI language, so
    // one left behind would show mm/dd/yyyy to anyone on an English browser
    // while every field beside it showed dd/mm/yyyy.
    const repoRoot = path.resolve(__dirname, "../../..");
    let found = "";
    try {
      found = execFileSync("grep", ["-rl", 'type="date"', "src"], {
        cwd: repoRoot,
        encoding: "utf8",
      });
    } catch (err) {
      // grep exits 1 when nothing matches, which is the ideal outcome here.
      if ((err as { status?: number }).status !== 1) throw err;
    }

    const hits = found
      .split("\n")
      .filter(Boolean)
      // date-field.tsx owns the one remaining native input (the OS picker's
      // hidden anchor); the lib and this test only mention it in prose.
      .filter(
        (file) =>
          ![
            "src/components/ui/date-field.tsx",
            "src/lib/date-input.ts",
            "src/lib/__tests__/date-input.test.ts",
          ].includes(file),
      );

    assert.deepEqual(hits, [], `use <DateField> instead: ${hits.join(", ")}`);
  });
});

describe("daysInMonth", () => {
  it("knows every month of a normal year", () => {
    const lengths = Array.from({ length: 12 }, (_, i) =>
      daysInMonth(2026, i + 1),
    );
    assert.deepEqual(lengths, [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
  });
});
