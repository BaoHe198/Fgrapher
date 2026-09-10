import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import {
  revalidatePublicProfile,
  revalidateProfileUsername,
} from "@/lib/cache";
import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { updateMeSchema } from "@/lib/validations/user";
import { contentScanner } from "@/services/moderation";

// Shared allowlist for GET and PATCH — both used to return whatever
// `db.user.findUnique`/`db.user.update` handed back with no `select`,
// which is every scalar column on User by default, including
// `passwordHash` (a bcrypt hash — never appropriate to send to any
// client, even the account owner's own) and admin-moderation-only
// fields (`adminNotes`, `suspendedReason`, `suspendedUntil`,
// `violationPoints`) that aren't meant to be user-facing. Keep this in
// sync with prisma/schema.prisma's User model deliberately, not
// automatically — a new sensitive field added there should require a
// conscious decision here, not silent inclusion.
const ME_SELECT = {
  id: true,
  email: true,
  emailVerified: true,
  firstName: true,
  lastName: true,
  username: true,
  avatar: true,
  name: true,
  image: true,
  coverImage: true,
  bio: true,
  phone: true,
  location: true,
  latitude: true,
  longitude: true,
  phoneVerified: true,
  phoneVerifiedAt: true,
  wardId: true,
  dateOfBirth: true,
  acceptingBookings: true,
  notificationPreferences: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET() {
  try {
    const session = await requireAuth();
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        ...ME_SELECT,
        roles: { where: { active: true }, select: { role: true } },
      },
    });

    return NextResponse.json(
      {
        data: user && { ...user, roles: user.roles.map((r) => r.role) },
        error: null,
        message: null,
      },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to load account" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();

    const body = await request.json();
    const parsed = updateMeSchema.safeParse(body);
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

    // Prompt G2, VIỆC 2 — avatar/cover skip the human moderation queue
    // portfolio photos go through, but still get scanned for auto-block
    // (never auto-approved into a queue — just outright rejected here if
    // flagged). MockScanner never flags anything today (see
    // services/moderation.ts's comment); this wiring is what a real
    // scanner implementation plugs into later.
    for (const url of [parsed.data.avatar, parsed.data.coverImage]) {
      if (!url) continue;
      const result = await contentScanner.scan({ url, publicId: null });
      if (result.verdict === "flagged") {
        const t = await getTranslations("apiMessages.users");
        return NextResponse.json(
          {
            data: null,
            error: "content_flagged",
            message: t("imageFlagged"),
          },
          { status: 422 },
        );
      }
    }

    const { wardId, phone, currentPassword, ...rest } = parsed.data;

    // Changing the account's email requires proving the current password
    // first — without this, a session alone (a stolen cookie, an XSS
    // payload, a shared/unlocked device — anything short of the password
    // itself) would be enough to silently redirect the account's email
    // to one an attacker controls, then use "forgot password" (which
    // sends the reset link to whatever `email` currently is) to take the
    // account over permanently, long after the original session is gone.
    // This app has no real "click the link we emailed you" verification
    // flow yet (emailVerified is only ever set once, at registration —
    // see auth.ts's signIn callback, which trusts it as proof credentials
    // login is allowed) — until one exists, this password re-check is the
    // actual barrier, not resetting emailVerified to something with no
    // way back.
    if (rest.email !== undefined) {
      const current = await db.user.findUnique({
        where: { id: session.user.id },
        select: { email: true, passwordHash: true },
      });
      if (current && rest.email !== current.email) {
        const t = await getTranslations("apiMessages.users");
        if (!current.passwordHash) {
          return NextResponse.json(
            {
              data: null,
              error: "no_password",
              message: t("emailChangeNoPassword"),
            },
            { status: 400 },
          );
        }
        const isValid =
          currentPassword &&
          (await bcrypt.compare(currentPassword, current.passwordHash));
        if (!isValid) {
          return NextResponse.json(
            {
              data: null,
              error: "invalid_password",
              message: t("emailChangeWrongPassword"),
            },
            { status: 400 },
          );
        }
      }
    }

    // Prompt G7 — a verified phone number is proof of THAT number, not of
    // whatever the user later types into this field. Any change re-locks
    // phoneVerified until the new number goes through /api/phone/verify-code.
    let phoneVerifiedUpdate: { phoneVerified?: boolean } = {};
    if (phone !== undefined) {
      const current = await db.user.findUnique({
        where: { id: session.user.id },
        select: { phone: true },
      });
      if (current?.phone !== phone) {
        phoneVerifiedUpdate = { phoneVerified: false };
      }
    }
    let locationUpdate: { location?: string } = {};
    if (wardId !== undefined) {
      if (wardId === null) {
        locationUpdate = { location: undefined };
      } else {
        const ward = await db.ward.findUnique({
          where: { id: wardId },
          select: { name: true, province: { select: { name: true } } },
        });
        if (!ward) {
          return NextResponse.json(
            {
              data: null,
              error: "validation_error",
              message: "That ward does not exist",
            },
            { status: 400 },
          );
        }
        // Keeps the existing free-text `location` in sync for every
        // display site that still reads it directly, rather than needing
        // a wardId join everywhere at once (see User.wardId's schema comment).
        locationUpdate = { location: `${ward.name}, ${ward.province.name}` };
      }
    }

    const previous = await db.user.findUnique({
      where: { id: session.user.id },
      select: { username: true },
    });

    const user = await db.user.update({
      where: { id: session.user.id },
      data: {
        ...rest,
        phone,
        wardId,
        ...locationUpdate,
        ...phoneVerifiedUpdate,
      },
      select: ME_SELECT,
    });

    // name / username / avatar / coverImage / location / acceptingBookings
    // all appear on the public profile and/or the browse cards.
    await revalidatePublicProfile(session.user.id);
    if (previous?.username && previous.username !== user.username) {
      // The old /profile/<username> URL now 404s, but its cache entry still
      // holds the pre-rename data — bump it explicitly (revalidatePublicProfile
      // only knows the new username).
      revalidateProfileUsername(previous.username);
    }

    return NextResponse.json(
      { data: user, error: null, message: "Account updated" },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }

    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const field = (err.meta?.target as string[] | undefined)?.[0] ?? "value";
      return NextResponse.json(
        {
          data: null,
          error: "conflict",
          message: `This ${field} is already taken`,
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        data: null,
        error: "server_error",
        message: "Failed to update account",
      },
      { status: 500 },
    );
  }
}

// Requires the current password for the same reason PATCH does for an
// email change — this is destructive and, unlike portfolio media/albums
// (which have a real restore endpoint), there's no self-service way back
// for a soft-deleted User row. A session alone (stolen cookie, XSS,
// unlocked device) shouldn't be enough to take that away from someone.
export async function DELETE(request: Request) {
  try {
    const session = await requireAuth();
    const t = await getTranslations("apiMessages.users");

    const body = await request.json().catch(() => ({}));
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true, username: true },
    });
    if (user?.passwordHash) {
      const isValid =
        typeof body.currentPassword === "string" &&
        (await bcrypt.compare(body.currentPassword, user.passwordHash));
      if (!isValid) {
        return NextResponse.json(
          {
            data: null,
            error: "invalid_password",
            message: t("emailChangeWrongPassword"),
          },
          { status: 400 },
        );
      }
    }
    // Accounts with no password (OAuth-only) have nothing to confirm
    // with — requireAuth()'s live session check is the only gate
    // available for those, same as it always was.

    await db.user.update({
      where: { id: session.user.id },
      data: { deletedAt: new Date() },
    });

    // Soft-delete leaves published Profile rows in place; the public reads now
    // filter on `user.deletedAt`, so evict the cached copies immediately.
    await revalidatePublicProfile(session.user.id);
    if (user?.username) revalidateProfileUsername(user.username);

    return NextResponse.json(
      { data: null, error: null, message: "Account deleted" },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      {
        data: null,
        error: "server_error",
        message: "Failed to delete account",
      },
      { status: 500 },
    );
  }
}
