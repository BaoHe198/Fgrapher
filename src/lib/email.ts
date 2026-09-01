import { Resend } from "resend";

import { env } from "@/lib/env";

// Every booking/order/review/subscription email template below takes a `t`
// (namespace "libServices.email") resolved by the caller via
// getTranslations() — request-context callers use the request's own locale,
// cron/webhook-triggered callers pass { locale: "vi" } explicitly (no
// request/cookie context to read a locale from). This file itself stays a
// thin template layer and never calls getTranslations() on its own.
type EmailT = (key: string, values?: Record<string, string | number>) => string;

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_ADDRESS = "Fgrapher <noreply@fgrapher.com>";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

// No-ops when RESEND_API_KEY isn't configured (e.g. local dev without the
// provider set up) rather than throwing, so auth flows stay testable without
// live email credentials.
//
// On staging, every email is redirected to a single test inbox rather than
// the real recipient — real API key, fake destination, so staging can
// exercise the real Resend integration without ever emailing an actual
// user. Set STAGING_TEST_INBOX to enable; unset, this falls through to
// sending nowhere differently (still gated by RESEND_API_KEY above).
export async function sendEmail({ to, subject, html }: SendEmailInput) {
  if (!resend) return;

  const isStaging = env.APP_ENV === "staging";
  const testInbox = process.env.STAGING_TEST_INBOX;
  const recipient = isStaging && testInbox ? testInbox : to;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: recipient,
    subject:
      isStaging && testInbox
        ? `[staging, would go to ${to}] ${subject}`
        : subject,
    html,
  });
}

// Every other export in this file is transactional — booking status
// changes, password resets, orders, reviews, subscription billing events
// — tied to a specific transaction the recipient is a party to, so none
// of them require ConsentPurpose.MARKETING (see services/compliance.ts).
// Promotional content (product updates, tips, newsletters) must go
// through this wrapper instead of calling sendEmail directly, so the
// consent check can't be silently skipped by a future call site. The
// caller resolves hasConsent(userId, "MARKETING") itself — this file
// stays a thin transport and doesn't reach into the services layer.
export async function sendMarketingEmail({
  to,
  subject,
  html,
  hasMarketingConsent,
}: SendEmailInput & { hasMarketingConsent: boolean }) {
  if (!hasMarketingConsent) return;
  await sendEmail({ to, subject, html });
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
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <div style="background-color: hsl(168 58% 15%); padding: 32px 24px; text-align: center;">
        <span style="color: #ffffff; font-size: 20px; font-weight: 700;">Fgrapher</span>
      </div>
      <div style="padding: 32px 24px; background-color: #ffffff;">
        <h1 style="font-size: 20px; margin: 0 0 12px; color: hsl(30 15% 11%);">Đặt lại mật khẩu</h1>
        <p style="font-size: 14px; line-height: 1.5; color: hsl(30 8% 38%); margin: 0 0 24px;">
          Chúng tôi nhận được yêu cầu đặt lại mật khẩu Fgrapher của bạn. Liên kết này hết hạn sau 1 giờ.
          Nếu bạn không yêu cầu điều này, bạn có thể bỏ qua email này.
        </p>
        <a
          href="${resetUrl}"
          style="display: inline-block; background-color: hsl(38 44% 52%); color: hsl(30 15% 11%); font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 12px; text-decoration: none;"
        >
          Đặt lại mật khẩu
        </a>
        <p style="font-size: 12px; line-height: 1.5; color: hsl(30 7% 52%); margin: 24px 0 0; word-break: break-all;">
          Hoặc sao chép liên kết này: ${resetUrl}
        </p>
      </div>
    </div>
  `;
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
}: {
  t: EmailT;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
}) {
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <div style="background-color: hsl(168 58% 15%); padding: 32px 24px; text-align: center;">
        <span style="color: #ffffff; font-size: 20px; font-weight: 700;">Fgrapher</span>
      </div>
      <div style="padding: 32px 24px; background-color: #ffffff;">
        <h1 style="font-size: 20px; margin: 0 0 12px; color: hsl(30 15% 11%);">${heading}</h1>
        <div style="font-size: 14px; line-height: 1.6; color: hsl(30 8% 38%); margin: 0 0 24px;">
          ${body}
        </div>
        ${
          ctaLabel && ctaUrl
            ? `<a
          href="${ctaUrl}"
          style="display: inline-block; background-color: hsl(38 44% 52%); color: hsl(30 15% 11%); font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 12px; text-decoration: none;"
        >
          ${ctaLabel}
        </a>`
            : ""
        }
      </div>
      <div style="padding: 16px 24px; background-color: hsl(30 20% 97%); text-align: center;">
        <a href="${process.env.NEXTAUTH_URL ?? ""}/dashboard/settings/notifications" style="font-size: 12px; color: hsl(30 7% 52%);">
          ${t("footer.manageNotifications")}
        </a>
      </div>
    </div>
  `;
}

interface BookingEmailBase {
  otherPartyName: string;
  serviceName: string;
  dateLabel: string;
  timeLabel: string;
  bookingUrl: string;
}

export function bookingRequestEmailHtml({
  t,
  otherPartyName,
  serviceName,
  dateLabel,
  timeLabel,
  bookingUrl,
}: BookingEmailBase & { t: EmailT }) {
  return bookingEmailShell({
    t,
    heading: t("bookingRequest.heading"),
    body: t("bookingRequest.body", {
      otherPartyName: `<strong>${otherPartyName}</strong>`,
      serviceName: `<strong>${serviceName}</strong>`,
      dateLabel,
      timeLabel,
    }),
    ctaLabel: t("bookingRequest.cta"),
    ctaUrl: bookingUrl,
  });
}

export function bookingConfirmedEmailHtml({
  t,
  otherPartyName,
  serviceName,
  dateLabel,
  timeLabel,
  bookingUrl,
}: BookingEmailBase & { t: EmailT }) {
  return bookingEmailShell({
    t,
    heading: t("bookingConfirmed.heading"),
    body: t("bookingConfirmed.body", {
      otherPartyName: `<strong>${otherPartyName}</strong>`,
      serviceName: `<strong>${serviceName}</strong>`,
      dateLabel,
      timeLabel,
    }),
    ctaLabel: t("bookingConfirmed.cta"),
    ctaUrl: bookingUrl,
  });
}

export function bookingDeclinedEmailHtml({
  t,
  otherPartyName,
  serviceName,
  dateLabel,
  timeLabel,
  bookingUrl,
}: BookingEmailBase & { t: EmailT; reason?: string }) {
  return bookingEmailShell({
    t,
    heading: t("bookingDeclined.heading"),
    body: t("bookingDeclined.body", {
      otherPartyName: `<strong>${otherPartyName}</strong>`,
      serviceName: `<strong>${serviceName}</strong>`,
      dateLabel,
      timeLabel,
    }),
    ctaLabel: t("bookingDeclined.cta"),
    ctaUrl: bookingUrl,
  });
}

export function bookingCancelledEmailHtml({
  t,
  otherPartyName,
  serviceName,
  dateLabel,
  timeLabel,
  bookingUrl,
}: BookingEmailBase & { t: EmailT }) {
  return bookingEmailShell({
    t,
    heading: t("bookingCancelled.heading"),
    body: t("bookingCancelled.body", {
      otherPartyName: `<strong>${otherPartyName}</strong>`,
      serviceName: `<strong>${serviceName}</strong>`,
      dateLabel,
      timeLabel,
    }),
    ctaLabel: t("bookingCancelled.cta"),
    ctaUrl: bookingUrl,
  });
}

export function bookingReminderEmailHtml({
  t,
  otherPartyName,
  serviceName,
  dateLabel,
  timeLabel,
  bookingUrl,
}: BookingEmailBase & { t: EmailT }) {
  return bookingEmailShell({
    t,
    heading: t("bookingReminder.heading"),
    body: t("bookingReminder.body", {
      otherPartyName: `<strong>${otherPartyName}</strong>`,
      serviceName: `<strong>${serviceName}</strong>`,
      dateLabel,
      timeLabel,
    }),
    ctaLabel: t("bookingReminder.cta"),
    ctaUrl: bookingUrl,
  });
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
      otherPartyName: `<strong>${otherPartyName}</strong>`,
      serviceName: `<strong>${serviceName}</strong>`,
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
      { roleNames: `<strong>${roleNames.join(", ")}</strong>` },
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
    body: t("paymentFailed.body", {
      graceEndsLabel: `<strong>${graceEndsLabel}</strong>`,
    }),
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
      periodEndLabel: `<strong>${periodEndLabel}</strong>`,
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
      amountLabel: `<strong>${amountLabel}</strong>`,
      periodEndLabel: `<strong>${periodEndLabel}</strong>`,
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
      orderNumber: `<strong>#${orderNumber}</strong>`,
      itemsSummary,
      totalLabel: `<strong>${totalLabel}</strong>`,
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
      customerName: `<strong>${customerName}</strong>`,
      orderNumber: `<strong>#${orderNumber}</strong>`,
      itemsSummary,
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
    heading: t("orderStatus.heading", { statusLabel }),
    body: t(detail ? "orderStatus.bodyWithDetail" : "orderStatus.body", {
      orderNumber: `<strong>#${orderNumber}</strong>`,
      statusLabel: `<strong>${statusLabel}</strong>`,
      ...(detail ? { detail } : {}),
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
      reviewerName: `<strong>${reviewerName}</strong>`,
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
    body: t("reviewResponse.body", {
      providerName: `<strong>${providerName}</strong>`,
    }),
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
      ? t("mediaApprovedAlbum.body", { count, album: albumTitle })
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
    body: t("mediaRejected.body", { reason: `<strong>${reason}</strong>` }),
    ctaLabel: t("mediaRejected.cta"),
    ctaUrl: portfolioUrl,
  });
}
