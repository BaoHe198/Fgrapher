import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

let loginSequence = 0;

function isolatedLoginIp() {
  // Parallel E2E browsers otherwise all share 127.0.0.1 and consume one
  // production rate-limit bucket. TEST-NET-2 addresses keep the limiter on
  // the real code path while isolating unrelated browser sessions.
  loginSequence += 1;
  const worker = Number(process.env.TEST_WORKER_INDEX ?? 0);
  return `198.51.${(worker % 250) + 1}.${(loginSequence % 250) + 1}`;
}

export async function login(page: Page, email: string, password: string) {
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": isolatedLoginIp(),
  });
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}
