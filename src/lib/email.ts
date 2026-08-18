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
