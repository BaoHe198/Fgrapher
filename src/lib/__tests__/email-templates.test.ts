import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bookingEmailShell,
  bookingExpiredEmailHtml,
  bookingRequestEmailHtml,
  bookingRescheduleProposedEmailHtml,
  mediaRejectedEmailHtml,
  newMessageEmailHtml,
  newOrderEmailHtml,
  requestNewOfferEmailHtml,
  resetPasswordEmailHtml,
  verifyEmailHtml,
} from "@/lib/email-templates";
import { escapeHtml } from "@/lib/utils";

// Imports the real templates. lib/email-templates.ts is deliberately free
// of `env`/`db`/Resend imports so this can exercise production markup
// directly rather than re-implementing it.

// Minimal stand-in for next-intl's t(): returns the key, with any supplied
// values appended, so the assertions below can look for injected markup
// without depending on the message catalogue.
const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key} ${Object.values(values).join(" ")}` : key;

const XSS = '<img src=x onerror="alert(1)">';
const LINK_HIJACK = '</a><a href="https://phish.example">Nhận ảnh</a>';

describe("escapeHtml", () => {
  it("escapes every HTML-significant character", () => {
    assert.equal(
      escapeHtml("<div class=\"a\" data-b='c'>x & y</div>"),
      "&lt;div class=&quot;a&quot; data-b=&#39;c&#39;&gt;x &amp; y&lt;/div&gt;",
    );
  });

  it("leaves ordinary text alone, including Vietnamese diacritics", () => {
    assert.equal(escapeHtml("Đặt lịch chụp ảnh"), "Đặt lịch chụp ảnh");
    assert.equal(escapeHtml(""), "");
  });
});

describe("bookingEmailShell", () => {
  it("escapes the CTA url so it cannot break out of the href", () => {
    const html = bookingEmailShell({
      t,
      heading: "Xin chào",
      body: "<p>ok</p>",
      ctaLabel: "Mở",
      ctaUrl: '/x" onmouseover="alert(1)',
    });
    assert.ok(!html.includes('onmouseover="alert(1)"'));
    assert.ok(html.includes("&quot; onmouseover=&quot;"));
  });

  it("passes body through as markup, since callers compose it", () => {
    const html = bookingEmailShell({
      t,
      heading: "h",
      body: "<strong>bold</strong>",
    });
    assert.ok(html.includes("<strong>bold</strong>"));
  });

  it("omits the CTA entirely when it has no url", () => {
    const html = bookingEmailShell({ t, heading: "h", body: "b" });
    assert.ok(!html.includes("<a\n"));
  });
});

// The regression these cover: every one of these values is user-controlled
// and was interpolated into the email raw. A provider could set their
// display name to markup and rewrite the call-to-action of a transactional
// email the platform sends to the other party on their behalf.
describe("user-controlled values are escaped", () => {
  it("escapes a display name in a booking email", () => {
    const html = bookingRequestEmailHtml({
      t,
      otherPartyName: LINK_HIJACK,
      serviceName: "Chụp cưới",
      dateLabel: "10/09/2026",
      timeLabel: "09:00",
      bookingUrl: "https://fgrapher.test/dashboard/bookings/1",
    });
    assert.ok(!html.includes('<a href="https://phish.example">'));
    assert.ok(html.includes("&lt;/a&gt;&lt;a href=&quot;"));
  });

  it("escapes a service name in a booking email", () => {
    const html = bookingRequestEmailHtml({
      t,
      otherPartyName: "Nguyễn Văn A",
      serviceName: XSS,
      dateLabel: "10/09/2026",
      timeLabel: "09:00",
      bookingUrl: "https://fgrapher.test/dashboard/bookings/1",
    });
    assert.ok(!html.includes("<img src=x"));
  });

  it("escapes a moderation reason", () => {
    const html = mediaRejectedEmailHtml({
      t,
      reason: XSS,
      portfolioUrl: "https://fgrapher.test/dashboard/portfolio",
    });
    assert.ok(!html.includes("<img src=x"));
  });

  it("escapes a customer name and order line summary", () => {
    const html = newOrderEmailHtml({
      t,
      orderNumber: "1001",
      customerName: LINK_HIJACK,
      itemsSummary: XSS,
      orderUrl: "https://fgrapher.test/dashboard/orders/1001",
    });
    assert.ok(!html.includes('<a href="https://phish.example">'));
    assert.ok(!html.includes("<img src=x"));
  });
});

describe("Task 4 templates — user-controlled values are escaped", () => {
  it("escapes the sender name and preview in a new-message email", () => {
    const html = newMessageEmailHtml({
      t,
      senderName: LINK_HIJACK,
      preview: XSS,
      conversationUrl: "https://fgrapher.test/dashboard/messages?c=1",
    });
    assert.ok(!html.includes('<a href="https://phish.example">'));
    assert.ok(!html.includes("<img src=x"));
  });

  it("escapes the proposer name in a reschedule email", () => {
    const html = bookingRescheduleProposedEmailHtml({
      t,
      otherPartyName: LINK_HIJACK,
      serviceName: "Chụp cưới",
      dateLabel: "12/09/2026",
      timeLabel: "10:00",
      bookingUrl: "https://fgrapher.test/dashboard/bookings/1",
    });
    assert.ok(!html.includes('<a href="https://phish.example">'));
  });

  it("escapes the request title and code in a service-request offer email", () => {
    const html = requestNewOfferEmailHtml({
      t,
      requestTitle: XSS,
      requestCode: '"><script>x</script>',
      requestUrl: "https://fgrapher.test/dashboard/requests/1",
    });
    assert.ok(!html.includes("<img src=x"));
    assert.ok(!html.includes("<script>"));
  });

  it("picks the customer vs provider body for an expired booking", () => {
    const forCustomer = bookingExpiredEmailHtml({
      t,
      recipientRole: "customer",
      otherPartyName: "Nguyễn Văn A",
      serviceName: "Chụp cưới",
      dateLabel: "12/09/2026",
      timeLabel: "10:00",
      bookingUrl: "https://fgrapher.test/dashboard/bookings/1",
    });
    const forProvider = bookingExpiredEmailHtml({
      t,
      recipientRole: "provider",
      otherPartyName: "Nguyễn Văn A",
      serviceName: "Chụp cưới",
      dateLabel: "12/09/2026",
      timeLabel: "10:00",
      bookingUrl: "https://fgrapher.test/dashboard/bookings/1",
    });
    assert.ok(forCustomer.includes("bookingExpired.bodyCustomer"));
    assert.ok(forProvider.includes("bookingExpired.bodyProvider"));
  });
});

describe("token links", () => {
  it("escapes the reset url in both the button and the copyable line", () => {
    const html = resetPasswordEmailHtml({
      resetUrl:
        'https://fgrapher.test/reset-password?token=a"><script>x</script>',
    });
    assert.ok(!html.includes("<script>"));
    assert.ok(html.includes("&lt;script&gt;"));
  });

  it("escapes the verification url", () => {
    const html = verifyEmailHtml({
      verifyUrl:
        'https://fgrapher.test/verify-email?token=a"><script>x</script>',
    });
    assert.ok(!html.includes("<script>"));
  });

  it("renders the verification link in both the button and the fallback line", () => {
    const url = "https://fgrapher.test/verify-email?token=abc123";
    const html = verifyEmailHtml({ verifyUrl: url });
    assert.equal(html.split(url).length - 1, 2);
  });
});
