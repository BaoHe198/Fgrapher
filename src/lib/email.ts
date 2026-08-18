import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM_ADDRESS = "Fgrapher <noreply@fgrapher.com>";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

// No-ops when RESEND_API_KEY isn't configured (e.g. local dev without the
// provider set up) rather than throwing, so auth flows stay testable without
// live email credentials.
export async function sendEmail({ to, subject, html }: SendEmailInput) {
  if (!resend) return;

  await resend.emails.send({ from: FROM_ADDRESS, to, subject, html });
}

export function resetPasswordEmailHtml({ resetUrl }: { resetUrl: string }) {
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <div style="background-color: hsl(168 58% 15%); padding: 32px 24px; text-align: center;">
        <span style="color: #ffffff; font-size: 20px; font-weight: 700;">Fgrapher</span>
      </div>
      <div style="padding: 32px 24px; background-color: #ffffff;">
        <h1 style="font-size: 20px; margin: 0 0 12px; color: hsl(30 15% 11%);">Reset your password</h1>
        <p style="font-size: 14px; line-height: 1.5; color: hsl(30 8% 38%); margin: 0 0 24px;">
          We received a request to reset your Fgrapher password. This link expires in 1 hour.
          If you didn't request this, you can safely ignore this email.
        </p>
        <a
          href="${resetUrl}"
          style="display: inline-block; background-color: hsl(38 44% 52%); color: hsl(30 15% 11%); font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 12px; text-decoration: none;"
        >
          Reset password
        </a>
        <p style="font-size: 12px; line-height: 1.5; color: hsl(30 7% 52%); margin: 24px 0 0; word-break: break-all;">
          Or copy this link: ${resetUrl}
        </p>
      </div>
    </div>
  `;
}

// Shared shell for booking emails — kept as plain template-literal HTML
// (not a full react-email component package) to match the existing
// resetPasswordEmailHtml pattern rather than adding a new templating
// dependency for six emails.
function bookingEmailShell({
  heading,
  body,
  ctaLabel,
  ctaUrl,
}: {
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
          Manage notification preferences
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
  otherPartyName,
  serviceName,
  dateLabel,
  timeLabel,
  bookingUrl,
}: BookingEmailBase) {
  return bookingEmailShell({
    heading: "New booking request",
    body: `<p><strong>${otherPartyName}</strong> requested to book <strong>${serviceName}</strong> on ${dateLabel} at ${timeLabel}. Respond within 24 hours to keep your response rate up.</p>`,
    ctaLabel: "View request",
    ctaUrl: bookingUrl,
  });
}

export function bookingConfirmedEmailHtml({
  otherPartyName,
  serviceName,
  dateLabel,
  timeLabel,
  bookingUrl,
}: BookingEmailBase) {
  return bookingEmailShell({
    heading: "Booking confirmed",
    body: `<p><strong>${otherPartyName}</strong> confirmed your <strong>${serviceName}</strong> booking on ${dateLabel} at ${timeLabel}. We'll remind you 24 hours before.</p>`,
    ctaLabel: "View booking",
    ctaUrl: bookingUrl,
  });
}

export function bookingDeclinedEmailHtml({
  otherPartyName,
  serviceName,
  dateLabel,
  timeLabel,
  bookingUrl,
}: BookingEmailBase & { reason?: string }) {
  return bookingEmailShell({
    heading: "Booking declined",
    body: `<p><strong>${otherPartyName}</strong> wasn't able to accept your <strong>${serviceName}</strong> request for ${dateLabel} at ${timeLabel}. Browse other artists to find someone available.</p>`,
    ctaLabel: "Browse artists",
    ctaUrl: bookingUrl,
  });
}

export function bookingCancelledEmailHtml({
  otherPartyName,
  serviceName,
  dateLabel,
  timeLabel,
  bookingUrl,
}: BookingEmailBase) {
  return bookingEmailShell({
    heading: "Booking cancelled",
    body: `<p><strong>${otherPartyName}</strong> cancelled the <strong>${serviceName}</strong> booking on ${dateLabel} at ${timeLabel}.</p>`,
    ctaLabel: "View bookings",
    ctaUrl: bookingUrl,
  });
}

export function bookingReminderEmailHtml({
  otherPartyName,
  serviceName,
  dateLabel,
  timeLabel,
  bookingUrl,
}: BookingEmailBase) {
  return bookingEmailShell({
    heading: "Booking tomorrow",
    body: `<p>Reminder: your <strong>${serviceName}</strong> session with <strong>${otherPartyName}</strong> is on ${dateLabel} at ${timeLabel} — less than 24 hours away.</p>`,
    ctaLabel: "View booking",
    ctaUrl: bookingUrl,
  });
}

export function bookingCompletedEmailHtml({
  otherPartyName,
  serviceName,
  bookingUrl,
}: BookingEmailBase) {
  return bookingEmailShell({
    heading: "How was your session?",
    body: `<p>Your <strong>${serviceName}</strong> session with <strong>${otherPartyName}</strong> is marked complete. Leave a review to help other clients.</p>`,
    ctaLabel: "Leave a review",
    ctaUrl: bookingUrl,
  });
}
