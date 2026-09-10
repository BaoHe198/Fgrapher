import { strict as assert } from "assert";

import { escapeHtml } from "@/lib/utils";

// Unit tests for email utilities — run with: npx tsx src/lib/__tests__/email.test.ts
// These tests verify input escaping and email result typing without Resend mocking.

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await Promise.resolve(fn());
    console.log(`✓ ${name}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`✗ ${name}: ${message}`);
    process.exit(1);
  }
}

async function runTests() {
  console.log("Running email module tests...\n");

  await test("escapeHtml: escapes HTML special characters", () => {
    const input = '<script>alert("xss")</script>';
    const output = escapeHtml(input);
    assert.strictEqual(
      output,
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
    );
  });

  await test("escapeHtml: escapes ampersand", () => {
    assert.strictEqual(escapeHtml("foo & bar"), "foo &amp; bar");
  });

  await test("escapeHtml: escapes single quotes", () => {
    assert.strictEqual(escapeHtml("it's a test"), "it&#39;s a test");
  });

  await test("escapeHtml: handles all special characters", () => {
    const input = "<div class=\"test\" data-id='123'>Content & more</div>";
    const output = escapeHtml(input);
    assert.strictEqual(
      output,
      "&lt;div class=&quot;test&quot; data-id=&#39;123&#39;&gt;Content &amp; more&lt;/div&gt;",
    );
  });

  await test("escapeHtml: returns unchanged text without special characters", () => {
    const input = "Hello World 123";
    assert.strictEqual(escapeHtml(input), input);
  });

  await test("escapeHtml: handles empty string", () => {
    assert.strictEqual(escapeHtml(""), "");
  });

  await test("escapeHtml: escapes in URLs", () => {
    const url =
      'https://example.com/reset?token=123"><script>alert("xss")</script>';
    const output = escapeHtml(url);
    assert(output.includes("&lt;script&gt;"));
    assert(!output.includes("<script>"));
  });

  console.log("\n✓ All tests passed!");
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
