import { expect, test } from "@playwright/test";

// Deliberately separate from the rest of this suite: every other spec file
// resets and seeds a disposable database (see e2e/global-setup.ts) and is
// unsafe to run against anything else. This file is read-only — no login,
// no writes, nothing that assumes a particular database state — because
// it's the one that runs against a real Vercel preview deployment in CI
// (.github/workflows/test.yml's `preview-smoke` job), which today is
// configured to use the shared dev database (see CLAUDE.md's "Database
// environments" section). Running the destructive suite there would slowly
// corrupt dev data on every PR; this smoke check exists so CI still
// catches preview-specific problems (a bad env var, a build that doesn't
// actually boot) without doing that.
const PAGES = ["/", "/pricing", "/browse", "/login", "/register"];

for (const path of PAGES) {
  test(`${path || "/"} loads with no console errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });

    const response = await page.goto(path);
    expect(response?.status()).toBeLessThan(400);
    expect(errors).toEqual([]);
  });
}
