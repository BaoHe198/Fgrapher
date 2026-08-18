import { NextResponse } from "next/server";
import { z } from "zod";

import { sendEmail } from "@/lib/email";

const contactSchema = z.object({
  name: z.string().min(1, "Enter your name"),
  email: z.string().email("Enter a valid email address"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = contactSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: "validation_error",
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      },
      { status: 400 },
    );
  }

  await sendEmail({
    to: "support@fgrapher.com",
    subject: `Contact form: ${parsed.data.name}`,
    html: `<p>From: ${parsed.data.name} (${parsed.data.email})</p><p>${parsed.data.message}</p>`,
  });

  return NextResponse.json(
    { data: null, error: null, message: "Message sent" },
    { status: 200 },
  );
}
