import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { getSupportEmail, sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/utils";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const contactSchema = z.object({
  name: z.string().min(1, "Enter your name").max(100),
  email: z.string().email("Enter a valid email address"),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(5000),
});

const CONTACT_RATE_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 };

export async function POST(request: Request) {
  const t = await getTranslations("apiMessages.contact");

  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`contact:${ip}`, CONTACT_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { data: null, error: "too_many_requests", message: t("tooManyRequests") },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const body = await request.json();
  const parsed = contactSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: "validation_error",
        message: parsed.error.issues[0]?.message ?? t("invalidInput"),
      },
      { status: 400 },
    );
  }

  const { name, email, message } = parsed.data;
  const result = await sendEmail({
    to: getSupportEmail(),
    subject: `Contact form: ${escapeHtml(name)}`,
    html: `<p>From: ${escapeHtml(name)} (${escapeHtml(email)})</p><p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`,
  });

  if (!result.success) {
    return NextResponse.json(
      {
        data: null,
        error: "email_send_failed",
        message: t("failedToSend"),
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { data: null, error: null, message: t("messageSent") },
    { status: 200 },
  );
}
