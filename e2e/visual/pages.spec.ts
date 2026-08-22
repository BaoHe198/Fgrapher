import { expect, test } from "@playwright/test";

// Runs once per project (visual-light sets colorScheme: "light", visual-dark
// sets colorScheme: "dark" — see playwright.config.ts). next-themes is
// configured with enableSystem, so it resolves from prefers-color-scheme
// with no theme in localStorage, and Playwright's colorScheme context
// option drives that media query directly — no manual class/localStorage
// manipulation needed.
const PAGES = [
  { name: "landing", path: "/" },
  { name: "pricing", path: "/pricing" },
  { name: "browse", path: "/browse" },
  { name: "login", path: "/login" },
];

for (const { name, path } of PAGES) {
  test(`${name} page`, async ({ page }) => {
    await page.goto(path, { waitUntil: "load" });
    // landing/browse poll in the background (notification badges etc —
    // see e2e/README.md), so they never reach network-idle at all;
    // Playwright's own guidance is to avoid that wait strategy for exactly
    // this reason. A short fixed settle covers font/image layout shift
    // instead.
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
  });
}
