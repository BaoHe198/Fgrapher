import { Resend } from "resend";
import crypto from "crypto";

import { db } from "@/lib/db";
import { env } from "@/lib/env";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_ADDRESS =
  process.env.EMAIL_FROM || "Fgrapher <noreply@fgrapher.com>";

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 60 * 1000; // 1 minute

function getNextAttemptTime(attempts: number): Date {
  const backoffMs = BASE_BACKOFF_MS * Math.pow(2, Math.min(attempts, 4));
  return new Date(Date.now() + backoffMs);
}

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

function generateIdempotencyKey(payload: EmailPayload): string {
  const data = `${payload.to}:${payload.subject}:${crypto.createHash("md5").update(payload.html).digest("hex")}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}

export async function enqueueEmail(payload: EmailPayload): Promise<void> {
  const idempotencyKey = generateIdempotencyKey(payload);

  await db.emailOutbox.upsert({
    where: { idempotencyKey },
    create: {
      idempotencyKey,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      status: "PENDING",
      nextAttemptAt: new Date(),
    },
    update: {
      nextAttemptAt: new Date(),
    },
  });
}

async function sendViaResend(email: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ id?: string; error?: string }> {
  if (!resend) {
    return { error: "resend_not_configured" };
  }

  const isStaging = env.APP_ENV === "staging";
  const testInbox = process.env.STAGING_TEST_INBOX;
  const recipient = isStaging && testInbox ? testInbox : email.to;

  try {
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to: recipient,
      subject:
        isStaging && testInbox
          ? `[staging, would go to ${email.to}] ${email.subject}`
          : email.subject,
      html: email.html,
    });

    if (result.error) {
      return { error: result.error.message };
    }

    return { id: result.data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { error: message };
  }
}

export async function processEmailOutbox(): Promise<void> {
  const now = new Date();
  const pendingEmails = await db.emailOutbox.findMany({
    where: {
      status: "PENDING",
      nextAttemptAt: { lte: now },
      attempts: { lt: MAX_ATTEMPTS },
    },
    take: 100,
  });

  for (const email of pendingEmails) {
    const { id, error: sendError } = await sendViaResend({
      to: email.to,
      subject: email.subject,
      html: email.html,
    });

    const attempts = email.attempts + 1;
    const status = sendError ? "PENDING" : "SENT";
    const nextAttemptAt =
      status === "PENDING" && attempts >= MAX_ATTEMPTS
        ? new Date(Date.now() + 24 * 60 * 60 * 1000)
        : status === "PENDING"
          ? getNextAttemptTime(attempts)
          : null;

    await db.emailOutbox.update({
      where: { id: email.id },
      data: {
        status: sendError && attempts >= MAX_ATTEMPTS ? "FAILED" : status,
        attempts,
        providerId: id,
        lastError: sendError,
        nextAttemptAt,
        sentAt: status === "SENT" ? now : null,
      },
    });

    if (sendError && env.NODE_ENV === "production") {
      console.error("[Email Outbox] Send failed", {
        message: sendError,
        attempts,
      });
    }
  }
}

export async function getEmailOutboxStats() {
  const [pending, sent, failed] = await Promise.all([
    db.emailOutbox.count({ where: { status: "PENDING" } }),
    db.emailOutbox.count({ where: { status: "SENT" } }),
    db.emailOutbox.count({ where: { status: "FAILED" } }),
  ]);

  return { pending, sent, failed };
}
