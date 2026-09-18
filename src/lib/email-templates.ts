import { appUrl } from "@/lib/app-url";
import { escapeHtml } from "@/lib/utils";

// Pure template layer: builds HTML strings and nothing else. No `env`, no
// `db`, no Resend — which is what makes it directly unit-testable (see
// lib/__tests__/email-templates.test.ts) without booting a validated env
// or a Prisma client. lib/email.ts re-exports everything here, so existing
// `import { bookingRequestEmailHtml } from "@/lib/email"` call sites are
// unaffected.

// Every booking/order/review/subscription email template below takes a `t`
// (namespace "libServices.email") resolved by the caller via
// getTranslations() — request-context callers use the request's own locale,
// cron/webhook-triggered callers pass { locale: "vi" } explicitly (no
// request/cookie context to read a locale from). This file itself stays a
// thin template layer and never calls getTranslations() on its own.
export type EmailT = (
  key: string,
  values?: Record<string, string | number>,
) => string;

// Every value below that originates with a user — display names, service
// names, album titles, moderation reasons, order line summaries — is
// escaped before it reaches the markup. These are interpolated straight
// into an HTML document that gets delivered to *another* user, so a
// provider who sets their display name to
// `</a><a href="https://phish.example">` was previously able to rewrite
// the call-to-action of a transactional email the platform sends on their
// behalf. escapeHtml existed for exactly this and was only wired into the
// contact form and the password-reset link.
const strong = (value: string | number) =>
  `<strong>${escapeHtml(String(value))}</strong>`;

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

/**
 * A readable plain-text rendering of one of the HTML emails above. Every
 * transactional email should carry a `text/plain` alternative alongside
 * the HTML — a missing one is a real spam-score signal at Gmail/Outlook —
 * and this derives it from the same markup so the two never drift.
 *
 * Not a general HTML-to-text converter: it only has to handle the narrow,
 * self-authored markup in this file. Links are kept as `label (url)` so
 * the call-to-action URL survives; block tags become newlines.
 */
export function emailHtmlToText(html: string): string {
  return html
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<div\b[^>]*data-email-preheader[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(
      /<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
      (_m, href, label) => {
        const text = label.replace(/<[^>]+>/g, "").trim();
        return text && text !== href ? `${text} (${href})` : href;
      },
    )
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#?\w+;/g, (e) => HTML_ENTITIES[e] ?? e)
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface ShellOptions {
  t?: EmailT;
  heading: string;
  /**
   * Pre-composed HTML — the one parameter that is intentionally NOT
   * escaped, because callers build it from a translated string containing
   * `<strong>` markup. Every *value* substituted into it must already
   * have gone through `strong()` or `escapeHtml()`.
   */
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  /** Safe, pre-composed HTML rendered below the primary CTA. */
  postscript?: string;
  footerLinkLabel?: string;
  footerLinkUrl?: string;
}

// Shared shell for booking emails — kept as plain template-literal HTML
// (not a full react-email component package) to match the existing
// resetPasswordEmailHtml pattern rather than adding a new templating
// dependency for six emails. Exported since it's also the generic
// heading/body/CTA shell every other non-booking transactional email in
// this file reuses (media moderation, role-change requests, ...) despite
// the booking-specific name.
export function bookingEmailShell({
  t,
  heading,
  body,
  ctaLabel,
  ctaUrl,
  postscript,
  footerLinkLabel,
  footerLinkUrl,
}: ShellOptions) {
  const escapedHeading = escapeHtml(heading);
  const footerLabel =
    footerLinkLabel ?? t?.("footer.manageNotifications") ?? "Mở Fgrapher";
  const footerUrl =
    footerLinkUrl ?? appUrl("/dashboard/settings/notifications");
  const notificationLabel =
    t?.("footer.notificationLabel") ?? "Thông báo từ Fgrapher";
  const brandTagline =
    t?.("footer.brandTagline") ?? "Kết nối những ý tưởng sáng tạo";
  const automaticNotice =
    t?.("footer.automaticNotice") ??
    "Đây là email tự động từ Fgrapher. Vui lòng không trả lời email này.";
  const cta =
    ctaLabel && ctaUrl
      ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 28px 0 0;">
          <tr>
            <td bgcolor="#d5aa63" style="border-radius: 12px; box-shadow: 0 6px 16px rgba(91, 66, 29, 0.18);">
              <a href="${escapeHtml(ctaUrl)}" style="display: inline-block; color: #211b16; font-family: Arial, Helvetica, sans-serif; font-size: 15px; font-weight: 700; line-height: 20px; padding: 14px 24px; text-decoration: none;">
                ${escapeHtml(ctaLabel)}&nbsp;&nbsp;→
              </a>
            </td>
          </tr>
        </table>`
      : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${escapedHeading}</title>
    <style>
      @media only screen and (max-width: 620px) {
        .fg-email-wrap { padding: 16px 10px !important; }
        .fg-email-header, .fg-email-content { padding-left: 24px !important; padding-right: 24px !important; }
        .fg-email-heading { font-size: 24px !important; line-height: 31px !important; }
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f2f5f4; color: #211b16;">
    <div data-email-preheader style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent; mso-hide: all;">${escapedHeading}&nbsp;·&nbsp;Fgrapher</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f2f5f4">
      <tr>
        <td class="fg-email-wrap" align="center" style="padding: 36px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width: 100%; max-width: 600px; border: 1px solid #dfe6e3; border-radius: 20px; background-color: #ffffff; box-shadow: 0 12px 32px rgba(18, 59, 50, 0.09); overflow: hidden;">
            <tr>
              <td class="fg-email-header" bgcolor="#123b32" style="padding: 24px 36px; border-bottom: 4px solid #d5aa63;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td width="42" height="42" align="center" valign="middle" bgcolor="#d5aa63" style="width: 42px; height: 42px; border-radius: 11px; color: #123b32; font-family: Arial, Helvetica, sans-serif; font-size: 21px; font-weight: 800;">F</td>
                    <td style="padding-left: 13px;">
                      <div style="color: #ffffff; font-family: Arial, Helvetica, sans-serif; font-size: 21px; font-weight: 750; line-height: 25px;">Fgrapher</div>
                      <div style="color: #b9d2ca; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 18px;">${escapeHtml(brandTagline)}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="fg-email-content" style="padding: 40px 40px 36px;">
                <div style="margin: 0 0 12px; color: #8a682f; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 1.3px; line-height: 16px; text-transform: uppercase;">${escapeHtml(notificationLabel)}</div>
                <h1 class="fg-email-heading" style="margin: 0 0 18px; color: #211b16; font-family: Arial, Helvetica, sans-serif; font-size: 28px; font-weight: 750; letter-spacing: -0.4px; line-height: 36px;">${escapedHeading}</h1>
                <div style="height: 3px; width: 48px; margin: 0 0 24px; border-radius: 2px; background-color: #d5aa63;"></div>
                <div style="margin: 0; color: #5e5751; font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 25px;">
                  ${body}
                </div>
                ${cta}
                ${postscript ?? ""}
              </td>
            </tr>
            <tr>
              <td bgcolor="#f8faf9" style="padding: 24px 40px; border-top: 1px solid #e7ecea; text-align: center;">
                <p style="margin: 0 0 8px; color: #88827c; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 18px;">${escapeHtml(automaticNotice)}</p>
                <a href="${escapeHtml(footerUrl)}" style="color: #246f5f; font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: 700; line-height: 18px; text-decoration: underline; text-underline-offset: 3px;">${escapeHtml(footerLabel)}</a>
              </td>
            </tr>
          </table>
          <p style="margin: 18px 0 0; color: #9a958f; font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 16px; text-align: center;">Fgrapher · ${escapeHtml(brandTagline)}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// TODO(i18n): this function's only caller (src/app/api/auth/forgot-password/
// route.ts) is outside this pass's file scope, and next-intl's
// getTranslations() is async while this function must stay sync (it just
// returns an HTML string with no request access of its own). Rather than
// force a required `t` param that would break that out-of-scope call site,
// the copy below is hardcoded to Vietnamese directly — matching the
// platform's Vietnamese-first default (CLAUDE.md rule 10, routing.defaultLocale
// = "vi") for the common case. Once forgot-password/route.ts is updated to
// resolve a `t` instance (namespace "libServices.email.resetPassword") and
// pass it through, this should switch to the same t()-based pattern as the
// rest of this file.
export function resetPasswordEmailHtml({ resetUrl }: { resetUrl: string }) {
  const escapedUrl = escapeHtml(resetUrl);
  return bookingEmailShell({
    heading: "Đặt lại mật khẩu",
    body: `<p style="margin: 0;">Chúng tôi nhận được yêu cầu đặt lại mật khẩu Fgrapher của bạn. Liên kết này hết hạn sau <strong style="color: #211b16;">1 giờ</strong>. Nếu bạn không yêu cầu điều này, bạn có thể bỏ qua email.</p>`,
    ctaLabel: "Đặt lại mật khẩu",
    ctaUrl: resetUrl,
    postscript: `<p style="margin: 24px 0 0; padding-top: 20px; border-top: 1px solid #e7ecea; color: #88827c; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 19px; word-break: break-all;">Nút không hoạt động? Sao chép liên kết này vào trình duyệt:<br><span style="color: #246f5f;">${escapedUrl}</span></p>`,
    footerLinkLabel: "Truy cập Fgrapher",
    footerLinkUrl: appUrl("/"),
  });
}

// Same hardcoded-Vietnamese rationale as resetPasswordEmailHtml above: the
// verification email is sent from the registration route and from the
// resend endpoint, and must also be sendable for a user who has no session
// and therefore no resolved locale.
export function verifyEmailHtml({ verifyUrl }: { verifyUrl: string }) {
  const escapedUrl = escapeHtml(verifyUrl);
  return bookingEmailShell({
    heading: "Xác minh email của bạn",
    body: `<p style="margin: 0;">Cảm ơn bạn đã đăng ký Fgrapher. Xác minh địa chỉ email để kích hoạt tài khoản và bắt đầu sử dụng nền tảng. Liên kết này hết hạn sau <strong style="color: #211b16;">24 giờ</strong>.</p><p style="margin: 14px 0 0; color: #88827c; font-size: 13px; line-height: 21px;">Nếu bạn không tạo tài khoản Fgrapher, bạn có thể bỏ qua email này.</p>`,
    ctaLabel: "Xác minh email",
    ctaUrl: verifyUrl,
    postscript: `<p style="margin: 24px 0 0; padding-top: 20px; border-top: 1px solid #e7ecea; color: #88827c; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 19px; word-break: break-all;">Nút không hoạt động? Sao chép liên kết này vào trình duyệt:<br><span style="color: #246f5f;">${escapedUrl}</span></p>`,
    footerLinkLabel: "Truy cập Fgrapher",
    footerLinkUrl: appUrl("/"),
  });
}

interface BookingEmailBase {
  otherPartyName: string;
  serviceName: string;
  dateLabel: string;
  timeLabel: string;
  bookingUrl: string;
}

function bookingEmail(
  kind: string,
  {
    t,
    otherPartyName,
    serviceName,
    dateLabel,
    timeLabel,
    bookingUrl,
  }: BookingEmailBase & { t: EmailT },
) {
  return bookingEmailShell({
    t,
    heading: t(`${kind}.heading`),
    body: t(`${kind}.body`, {
      otherPartyName: strong(otherPartyName),
      serviceName: strong(serviceName),
      dateLabel: escapeHtml(dateLabel),
      timeLabel: escapeHtml(timeLabel),
    }),
    ctaLabel: t(`${kind}.cta`),
    ctaUrl: bookingUrl,
  });
}

export function bookingRequestEmailHtml(
  props: BookingEmailBase & { t: EmailT },
) {
  return bookingEmail("bookingRequest", props);
}

export function bookingConfirmedEmailHtml(
  props: BookingEmailBase & { t: EmailT },
) {
  return bookingEmail("bookingConfirmed", props);
}

export function bookingDeclinedEmailHtml(
  props: BookingEmailBase & { t: EmailT; reason?: string },
) {
  return bookingEmail("bookingDeclined", props);
}

export function bookingCancelledEmailHtml(
  props: BookingEmailBase & { t: EmailT },
) {
  return bookingEmail("bookingCancelled", props);
}

export function bookingReminderEmailHtml(
  props: BookingEmailBase & { t: EmailT },
) {
  return bookingEmail("bookingReminder", props);
}

export function availabilityReminderEmailHtml({
  t,
  calendarUrl,
}: {
  t: EmailT;
  calendarUrl: string;
}) {
  return bookingEmailShell({
    t,
    heading: t("availabilityReminder.heading"),
    body: t("availabilityReminder.body"),
    ctaLabel: t("availabilityReminder.cta"),
    ctaUrl: calendarUrl,
  });
}

export function bookingRescheduleProposedEmailHtml(
  props: BookingEmailBase & { t: EmailT },
) {
  return bookingEmail("bookingRescheduleProposed", props);
}

export function bookingRescheduleAcceptedEmailHtml(
  props: BookingEmailBase & { t: EmailT },
) {
  return bookingEmail("bookingRescheduleAccepted", props);
}

export function bookingRescheduleDeclinedEmailHtml({
  t,
  otherPartyName,
  serviceName,
  bookingUrl,
}: BookingEmailBase & { t: EmailT }) {
  return bookingEmailShell({
    t,
    heading: t("bookingRescheduleDeclined.heading"),
    body: t("bookingRescheduleDeclined.body", {
      otherPartyName: strong(otherPartyName),
      serviceName: strong(serviceName),
    }),
    ctaLabel: t("bookingRescheduleDeclined.cta"),
    ctaUrl: bookingUrl,
  });
}

export function bookingExpiredEmailHtml({
  t,
  recipientRole,
  otherPartyName,
  serviceName,
  bookingUrl,
}: BookingEmailBase & { t: EmailT; recipientRole: "customer" | "provider" }) {
  const key =
    recipientRole === "customer"
      ? "bookingExpired.bodyCustomer"
      : "bookingExpired.bodyProvider";
  return bookingEmailShell({
    t,
    heading: t("bookingExpired.heading"),
    body: t(key, {
      otherPartyName: strong(otherPartyName),
      serviceName: strong(serviceName),
    }),
    ctaLabel: t("bookingExpired.cta"),
    ctaUrl: bookingUrl,
  });
}

export function bookingRelatedCancelledEmailHtml({
  t,
  serviceName,
  bookingUrl,
}: {
  t: EmailT;
  serviceName: string;
  bookingUrl: string;
}) {
  return bookingEmailShell({
    t,
    heading: t("bookingRelatedCancelled.heading"),
    body: t("bookingRelatedCancelled.body", {
      serviceName: strong(serviceName),
    }),
    ctaLabel: t("bookingRelatedCancelled.cta"),
    ctaUrl: bookingUrl,
  });
}

// --- Messaging ---------------------------------------------------------

export function newMessageEmailHtml({
  t,
  senderName,
  preview,
  conversationUrl,
}: {
  t: EmailT;
  senderName: string;
  preview: string;
  conversationUrl: string;
}) {
  return bookingEmailShell({
    t,
    heading: t("newMessage.heading", { senderName: escapeHtml(senderName) }),
    body: `<p style="margin: 0 0 16px;">${t("newMessage.bodyIntro", {
      senderName: strong(senderName),
    })}</p><div style="padding: 16px 18px; border-left: 4px solid #d5aa63; border-radius: 0 12px 12px 0; background-color: #f5f8f7; color: #302a25; font-size: 15px; font-weight: 600; line-height: 23px;">“${escapeHtml(preview)}”</div>`,
    ctaLabel: t("newMessage.cta"),
    ctaUrl: conversationUrl,
  });
}

// --- Reverse marketplace / service requests --------------------------

interface ServiceRequestEmailBase {
  t: EmailT;
  requestTitle: string;
  requestCode: string;
  requestUrl: string;
}

function serviceRequestEmail(
  kind: string,
  { t, requestTitle, requestCode, requestUrl }: ServiceRequestEmailBase,
) {
  return bookingEmailShell({
    t,
    heading: t(`${kind}.heading`),
    body: t(`${kind}.body`, {
      requestTitle: strong(requestTitle),
      requestCode: escapeHtml(requestCode),
    }),
    ctaLabel: t(`${kind}.cta`),
    ctaUrl: requestUrl,
  });
}

export function requestNewOfferEmailHtml(props: ServiceRequestEmailBase) {
  return serviceRequestEmail("requestNewOffer", props);
}

export function requestOfferAcceptedEmailHtml(props: ServiceRequestEmailBase) {
  return serviceRequestEmail("requestOfferAccepted", props);
}

export function requestOfferDeclinedEmailHtml(props: ServiceRequestEmailBase) {
  return serviceRequestEmail("requestOfferDeclined", props);
}

export function requestNoOffersEmailHtml(props: ServiceRequestEmailBase) {
  return serviceRequestEmail("requestNoOffers", props);
}

export function bookingCompletedEmailHtml({
  t,
  otherPartyName,
  serviceName,
  bookingUrl,
}: BookingEmailBase & { t: EmailT }) {
  return bookingEmailShell({
    t,
    heading: t("bookingCompleted.heading"),
    body: t("bookingCompleted.body", {
      otherPartyName: strong(otherPartyName),
      serviceName: strong(serviceName),
    }),
    ctaLabel: t("bookingCompleted.cta"),
    ctaUrl: bookingUrl,
  });
}

export function welcomeSubscriptionEmailHtml({
  t,
  roleNames,
  billingUrl,
}: {
  t: EmailT;
  roleNames: string[];
  billingUrl: string;
}) {
  return bookingEmailShell({
    t,
    heading: t("welcomeSubscription.heading"),
    body: t(
      roleNames.length > 1
        ? "welcomeSubscription.bodyPlural"
        : "welcomeSubscription.bodySingular",
      { roleNames: strong(roleNames.join(", ")) },
    ),
    ctaLabel: t("welcomeSubscription.cta"),
    ctaUrl: billingUrl,
  });
}

export function paymentFailedEmailHtml({
  t,
  graceEndsLabel,
  billingUrl,
}: {
  t: EmailT;
  graceEndsLabel: string;
  billingUrl: string;
}) {
  return bookingEmailShell({
    t,
    heading: t("paymentFailed.heading"),
    body: t("paymentFailed.body", { graceEndsLabel: strong(graceEndsLabel) }),
    ctaLabel: t("paymentFailed.cta"),
    ctaUrl: billingUrl,
  });
}

export function subscriptionCancellingEmailHtml({
  t,
  periodEndLabel,
  billingUrl,
}: {
  t: EmailT;
  periodEndLabel: string;
  billingUrl: string;
}) {
  return bookingEmailShell({
    t,
    heading: t("subscriptionCancelling.heading"),
    body: t("subscriptionCancelling.body", {
      periodEndLabel: strong(periodEndLabel),
    }),
    ctaLabel: t("subscriptionCancelling.cta"),
    ctaUrl: billingUrl,
  });
}

export function subscriptionEndedEmailHtml({
  t,
  billingUrl,
}: {
  t: EmailT;
  billingUrl: string;
}) {
  return bookingEmailShell({
    t,
    heading: t("subscriptionEnded.heading"),
    body: t("subscriptionEnded.body"),
    ctaLabel: t("subscriptionEnded.cta"),
    ctaUrl: billingUrl,
  });
}

export function receiptEmailHtml({
  t,
  amountLabel,
  periodEndLabel,
  invoiceUrl,
}: {
  t: EmailT;
  amountLabel: string;
  periodEndLabel: string;
  invoiceUrl: string;
}) {
  return bookingEmailShell({
    t,
    heading: t("receipt.heading"),
    body: t("receipt.body", {
      amountLabel: strong(amountLabel),
      periodEndLabel: strong(periodEndLabel),
    }),
    ctaLabel: t("receipt.cta"),
    ctaUrl: invoiceUrl,
  });
}

export function orderConfirmationEmailHtml({
  t,
  orderNumber,
  itemsSummary,
  totalLabel,
  orderUrl,
}: {
  t: EmailT;
  orderNumber: string;
  itemsSummary: string;
  totalLabel: string;
  orderUrl: string;
}) {
  return bookingEmailShell({
    t,
    heading: t("orderConfirmation.heading"),
    body: t("orderConfirmation.body", {
      orderNumber: strong(`#${orderNumber}`),
      itemsSummary: escapeHtml(itemsSummary),
      totalLabel: strong(totalLabel),
    }),
    ctaLabel: t("orderConfirmation.cta"),
    ctaUrl: orderUrl,
  });
}

export function newOrderEmailHtml({
  t,
  orderNumber,
  customerName,
  itemsSummary,
  orderUrl,
}: {
  t: EmailT;
  orderNumber: string;
  customerName: string;
  itemsSummary: string;
  orderUrl: string;
}) {
  return bookingEmailShell({
    t,
    heading: t("newOrder.heading"),
    body: t("newOrder.body", {
      customerName: strong(customerName),
      orderNumber: strong(`#${orderNumber}`),
      itemsSummary: escapeHtml(itemsSummary),
    }),
    ctaLabel: t("newOrder.cta"),
    ctaUrl: orderUrl,
  });
}

export function orderStatusEmailHtml({
  t,
  orderNumber,
  statusLabel,
  detail,
  orderUrl,
}: {
  t: EmailT;
  orderNumber: string;
  statusLabel: string;
  detail?: string;
  orderUrl: string;
}) {
  return bookingEmailShell({
    t,
    heading: t("orderStatus.heading", { statusLabel: escapeHtml(statusLabel) }),
    body: t(detail ? "orderStatus.bodyWithDetail" : "orderStatus.body", {
      orderNumber: strong(`#${orderNumber}`),
      statusLabel: strong(statusLabel),
      ...(detail ? { detail: escapeHtml(detail) } : {}),
    }),
    ctaLabel: t("orderStatus.cta"),
    ctaUrl: orderUrl,
  });
}

export function newReviewEmailHtml({
  t,
  reviewerName,
  rating,
  bookingUrl,
}: {
  t: EmailT;
  reviewerName: string;
  rating: number;
  bookingUrl: string;
}) {
  return bookingEmailShell({
    t,
    heading: t("newReview.heading"),
    body: t("newReview.body", {
      reviewerName: strong(reviewerName),
      rating,
    }),
    ctaLabel: t("newReview.cta"),
    ctaUrl: bookingUrl,
  });
}

export function reviewResponseEmailHtml({
  t,
  providerName,
  bookingUrl,
}: {
  t: EmailT;
  providerName: string;
  bookingUrl: string;
}) {
  return bookingEmailShell({
    t,
    heading: t("reviewResponse.heading"),
    body: t("reviewResponse.body", { providerName: strong(providerName) }),
    ctaLabel: t("reviewResponse.cta"),
    ctaUrl: bookingUrl,
  });
}

export function mediaApprovedEmailHtml({
  t,
  portfolioUrl,
  count,
  albumTitle,
}: {
  t: EmailT;
  portfolioUrl: string;
  count: number;
  albumTitle: string | null;
}) {
  return bookingEmailShell({
    t,
    heading: t("mediaApproved.heading"),
    body: albumTitle
      ? t("mediaApprovedAlbum.body", { count, album: escapeHtml(albumTitle) })
      : t("mediaApproved.body", { count }),
    ctaLabel: t("mediaApproved.cta"),
    ctaUrl: portfolioUrl,
  });
}

export function mediaRejectedEmailHtml({
  t,
  reason,
  portfolioUrl,
}: {
  t: EmailT;
  reason: string;
  portfolioUrl: string;
}) {
  return bookingEmailShell({
    t,
    heading: t("mediaRejected.heading"),
    body: t("mediaRejected.body", { reason: strong(reason) }),
    ctaLabel: t("mediaRejected.cta"),
    ctaUrl: portfolioUrl,
  });
}
