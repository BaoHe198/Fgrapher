import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";

import { ResendVerificationForm } from "@/app/(auth)/verify-email/verify-email-panel";
import messages from "@/messages/vi.json";

// A render check, not a predicate check: the bug this guards against was
// purely in the markup — the compact layout rendered no email field while
// the submit button stayed gated on a non-empty address, so the login
// page's resend prompt could never be submitted. Only rendering catches
// that.
//
// Static server rendering is enough here (the form's initial paint is what
// was broken) and avoids pulling a DOM test environment into the repo.
//
// next-intl logs an ENVIRONMENT_FALLBACK error during these renders: it
// notices it isn't inside a real Next.js server environment and falls back
// to the client provider below, which resolves messages correctly. The log
// is expected noise, not a failure.

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="vi" messages={messages}>
      {node}
    </NextIntlClientProvider>,
  );
}

function inputCount(html: string): number {
  return (html.match(/<input\b/g) ?? []).length;
}

function isSubmitDisabled(html: string): boolean {
  const button = html
    .match(/<button\b[^>]*>/g)
    ?.find((tag) => tag.includes('type="submit"'));
  assert.ok(button, "expected a submit button in the rendered form");
  // Must match the ATTRIBUTE, which React renders as `disabled=""`. A bare
  // `includes("disabled")` matches the Tailwind `disabled:opacity-50`
  // variant sitting in the class list and reports every button as disabled.
  return /\sdisabled=""/.test(button);
}

describe("ResendVerificationForm markup", () => {
  for (const compact of [false, true]) {
    describe(compact ? "compact layout" : "full layout", () => {
      it("renders an email field the user can fill in", () => {
        const html = render(
          <ResendVerificationForm initialEmail="" compact={compact} />,
        );
        assert.equal(
          inputCount(html),
          1,
          "without a field the address can never become non-empty",
        );
        assert.match(html, /type="email"/);
      });

      it("gives that field an accessible name", () => {
        const html = render(
          <ResendVerificationForm initialEmail="" compact={compact} />,
        );
        // The compact layout drops the visible <label>, so it must carry
        // aria-label instead — an unlabelled input is not an acceptable
        // way to make the field "present".
        const hasLabel = /<label\b/.test(html);
        const hasAriaLabel = /aria-label="/.test(html);
        assert.ok(
          hasLabel || hasAriaLabel,
          "the email field needs a visible or accessible label",
        );
      });

      it("is submittable once an address is present", () => {
        const html = render(
          <ResendVerificationForm
            initialEmail="nguyen@example.com"
            compact={compact}
          />,
        );
        assert.equal(
          isSubmitDisabled(html),
          false,
          "a prefilled form must be submittable on first paint",
        );
      });

      it("starts disabled with no address, but the field to fix that exists", () => {
        const html = render(
          <ResendVerificationForm initialEmail="" compact={compact} />,
        );
        assert.equal(isSubmitDisabled(html), true);
        assert.equal(inputCount(html), 1);
      });
    });
  }
});
