import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { registerSchema } from "@/lib/validations/auth";
import { assignFreePlan } from "@/services/subscription";
import { Prisma } from "@prisma/client";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = registerSchema.safeParse(body);

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

  const {
    name,
    email,
    password,
    roles,
    dateOfBirth,
    acceptedContentGuidelines,
  } = parsed.data;
  const [firstName, ...rest] = name.trim().split(/\s+/);
  const lastName = rest.join(" ") || null;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      {
        data: null,
        error: "email_taken",
        message: "An account with this email already exists",
      },
      { status: 400 },
    );
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const uniqueRoles = Array.from(new Set(roles));
    const isModel = uniqueRoles.includes("MODEL");

    const user = await db.user.create({
      data: {
        email,
        firstName,
        lastName,
        name: name.trim(),
        passwordHash,
        // No email-delivery provider is wired up yet (phase 0); treat
        // registrations as verified until a real verification flow exists.
        emailVerified: new Date(),
        // Age gate (docs/guides/fgrapher-prompts-batch-2.md §3b) — only
        // collected/required when MODEL is among the selected roles;
        // registerSchema already enforced >= 18 before this route runs.
        dateOfBirth: isModel && dateOfBirth ? new Date(dateOfBirth) : undefined,
        roles: {
          create: [
            { role: "CUSTOMER", active: true },
            // Paid roles start inactive until a subscription is created —
            // either by Stripe Checkout completing (BILLING_ENABLED=true)
            // or, while billing is disabled, immediately below via
            // assignFreePlan.
            ...uniqueRoles.map((role) => ({
              role,
              active: false,
              ...(role === "MODEL" && acceptedContentGuidelines
                ? { contentGuidelinesAcceptedAt: new Date() }
                : {}),
            })),
          ],
        },
      },
    });

    // BILLING_ENABLED=false (Stripe can't take a Vietnam-registered
    // merchant account — see CLAUDE.md): every paid role gets a free
    // 12-month plan immediately instead of being routed through Stripe
    // Checkout. onboarding/billing redirects straight past its own step
    // when this flag is off, so this is the only place that activates
    // these roles in that case.
    if (!features.billingEnabled && uniqueRoles.length > 0) {
      await assignFreePlan(user.id, uniqueRoles);
    }

    return NextResponse.json(
      {
        data: { id: user.id, email: user.email },
        error: null,
        message: "Account created",
      },
      { status: 201 },
    );
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        {
          data: null,
          error: "email_taken",
          message: "An account with this email already exists",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        data: null,
        error: "server_error",
        message: "Failed to create account",
      },
      { status: 500 },
    );
  }
}
