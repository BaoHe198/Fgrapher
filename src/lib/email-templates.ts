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

interface ShellOptions {
  t: EmailT;
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
}: ShellOptions) {
  const cta =
    ctaLabel && ctaUrl
      ? `<a
          href="${escapeHtml(ctaUrl)}"
          style="display: inline-block; background-color: hsl(38 44% 52%); color: hsl(30 15% 11%); font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 12px; text-decoration: none;"
        >
          ${escapeHtml(ctaLabel)}
        </a>`
      : "";

  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <div style="background-color: hsl(168 58% 15%); padding: 32px 24px; text-align: center;">
        <span style="color: #ffffff; font-size: 20px; font-weight: 700;">Fgrapher</span>
      </div>
      <div style="padding: 32px 24px; background-color: #ffffff;">
        <h1 style="font-size: 20px; margin: 0 0 12px; color: hsl(30 15% 11%);">${escapeHtml(heading)}</h1>
        <div style="font-size: 14px; line-height: 1.6; color: hsl(30 8% 38%); margin: 0 0 24px;">
          ${body}
        </div>
        ${cta}
      </div>
      <div style="padding: 16px 24px; background-color: hsl(30 20% 97%); text-align: center;">
        <a href="${escapeHtml(appUrl("/dashboard/settings/notifications"))}" style="font-size: 12px; color: hsl(30 7% 52%);">
          ${escapeHtml(t("footer.manageNotifications"))}
        </a>
      </div>
    </div>
  `;
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
          href="${escapedUrl}"
          style="display: inline-block; background-color: hsl(38 44% 52%); color: hsl(30 15% 11%); font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 12px; text-decoration: none;"
        >
          Đặt lại mật khẩu
        </a>
        <p style="font-size: 12px; line-height: 1.5; color: hsl(30 7% 52%); margin: 24px 0 0; word-break: break-all;">
          Hoặc sao chép liên kết này: ${escapedUrl}
        </p>
      </div>
    </div>
  `;
}

// Same hardcoded-Vietnamese rationale as resetPasswordEmailHtml above: the
// verification email is sent from the registration route and from the
// resend endpoint, and must also be sendable for a user who has no session
// and therefore no resolved locale.
export function verifyEmailHtml({ verifyUrl }: { verifyUrl: string }) {
  const escapedUrl = escapeHtml(verifyUrl);
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <div style="background-color: hsl(168 58% 15%); padding: 32px 24px; text-align: center;">
        <span style="color: #ffffff; font-size: 20px; font-weight: 700;">Fgrapher</span>
      </div>
      <div style="padding: 32px 24px; background-color: #ffffff;">
        <h1 style="font-size: 20px; margin: 0 0 12px; color: hsl(30 15% 11%);">Xác minh email của bạn</h1>
        <p style="font-size: 14px; line-height: 1.5; color: hsl(30 8% 38%); margin: 0 0 24px;">
          Cảm ơn bạn đã đăng ký Fgrapher. Nhấn nút bên dưới để xác minh địa chỉ email và kích hoạt tài khoản.
          Liên kết này hết hạn sau 24 giờ.
          Nếu bạn không tạo tài khoản Fgrapher, bạn có thể bỏ qua email này.
        </p>
        <a
          href="${escapedUrl}"
          style="display: inline-block; background-color: hsl(38 44% 52%); color: hsl(30 15% 11%); font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 12px; text-decoration: none;"
        >
          Xác minh email
        </a>
        <p style="font-size: 12px; line-height: 1.5; color: hsl(30 7% 52%); margin: 24px 0 0; word-break: break-all;">
          Hoặc sao chép liên kết này: ${escapedUrl}
        </p>
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
    body: t("newMessage.body", {
      senderName: strong(senderName),
      preview: strong(preview),
    }),
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
