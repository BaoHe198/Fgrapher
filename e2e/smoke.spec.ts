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

// Regression for a real bug: footer.tsx's "Discover" role links used
// ?role= (singular) while /browse only ever reads ?roles= (plural,
// comma-separated) — the query silently matched nothing, so every
// footer role link landed on the fully-unfiltered browse page with no
// checkbox ticked. Read-only (no login, no writes) — safe alongside the
// rest of this file's checks.
test("footer role link filters /browse via roles= (not role=)", async ({
  page,
}) => {
  await page.goto("/");
  // Target the href directly rather than the link's visible label — this
  // page can render in either locale (EN/VI, cookie-based, no URL
  // segment), and the actual bug was in the query contract, not the copy.
  const link = page.locator('footer a[href*="/browse?"]').first();
  await link.click();
  await page.waitForURL(/\/browse/);

  const url = new URL(page.url());
  expect(url.searchParams.get("roles")).toBeTruthy();
  expect(url.searchParams.has("role")).toBe(false);
});
