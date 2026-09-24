import { defineConfig, devices } from "@playwright/test";

// When BASE_URL is set (CI running against a Vercel preview deployment),
// Playwright drives that remote URL directly and never starts a local
// server. Locally, BASE_URL is unset — Playwright starts `next start`
// against whatever database `.env.test` points at (see e2e/README.md).
//
// Port 3100, not 3000, deliberately: `next dev` owns 3000 on a developer's
// machine, and `reuseExistingServer` below would happily adopt it — handing
// the whole suite a server wired to the DEV database while global-setup had
// just reset the (separate) test database. Tests would then read and write
// real dev data. Using a port nothing else claims makes that impossible
// instead of making it something you have to remember. Override with
// E2E_PORT if 3100 is taken too. CI has no dev server and its workflow env
// pins NEXTAUTH_URL to :3000, so CI keeps 3000 and stays byte-identical.
const localPort = process.env.E2E_PORT ?? (process.env.CI ? "3000" : "3100");
const baseURL = process.env.BASE_URL ?? `http://localhost:${localPort}`;
const isRemoteTarget = Boolean(process.env.BASE_URL);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "html",
  globalSetup:
    isRemoteTarget || process.env.SKIP_GLOBAL_SETUP
      ? undefined
      : "./e2e/global-setup.ts",
  // Generous: messaging.spec.ts's cross-tab checks legitimately wait out a
  // real 4s poll interval plus real network latency to the database, which
  // can approach 30s on its own — not a flake to paper over.
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "e2e",
      testDir: "./e2e",
      testIgnore: [/visual\//, /smoke\.spec\.ts/],
      use: { ...devices["Desktop Chrome"], colorScheme: "light" },
    },
    // Read-only, no database dependency — the one safe to point at a real
    // Vercel preview deployment (see e2e/smoke.spec.ts's own comment).
    {
      name: "smoke",
      testDir: "./e2e",
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], colorScheme: "light" },
    },
    {
      name: "visual-light",
      testDir: "./e2e/visual",
      use: { ...devices["Desktop Chrome"], colorScheme: "light" },
    },
    {
      name: "visual-dark",
      testDir: "./e2e/visual",
      use: { ...devices["Desktop Chrome"], colorScheme: "dark" },
    },
  ],
  // Only start (and wait on) a local server when there's no remote
  // BASE_URL to hit instead. Uses `next start` against a real production
  // build so it matches what CI exercises on a preview deployment as
  // closely as possible — `next dev`'s HMR/dev-only behavior would be a
  // meaningfully different thing to test.
  webServer: isRemoteTarget
    ? undefined
    : {
        command: "pnpm build && pnpm start",
        url: baseURL,
        // Never reuse. Moving to port 3100 kept the suite off the dev
        // server, but a server left over from an earlier e2e run still got
        // adopted: on 24/09 a run silently reused one built an hour and a
        // half earlier, from code that predated a merge and a migration,
        // against a database global-setup had just rebuilt on the new
        // schema — 31 of 34 specs failed on ERR_ABORTED, none for a reason
        // in the code under test. A fresh build per run costs about a
        // minute; if the port is taken, Playwright now stops and says so.
        reuseExistingServer: false,
        timeout: 180_000,
        env: { NODE_ENV: "production", PORT: localPort },
      },
});
