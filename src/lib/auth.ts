import type { Role } from "@prisma/client";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { cache } from "react";

/**
 * How long the roles and display name baked into the JWT may be stale.
 * Short enough that a role change is visible almost immediately, long enough
 * that the query leaves the per-request hot path.
 */
const SESSION_SYNC_MS = 60_000;

/**
 * Keep authentication lifetime explicit instead of relying on Auth.js's
 * library default. This value governs both the encrypted JWT and its session
 * cookie, so a session cannot remain valid indefinitely after its issue time.
 */
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

import {
  ACCOUNT_SUSPENDED_CODE,
  EMAIL_NOT_VERIFIED_CODE,
} from "@/lib/auth-errors";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validations/auth";
import { PAID_ROLES } from "@/lib/constants";
import { resolvePartyName } from "@/lib/party-name";
import { joinVietnameseName } from "@/lib/vietnamese-name";
import { assignUsernameIfMissing } from "@/services/username";

// Two layers: per-IP catches a scripted credential-stuffing loop trying
// many different accounts from one source; per-email catches someone
// brute-forcing (or credential-stuffing) one specific account while
// rotating IPs. Neither existed before — authorize() ran a straight
// bcrypt.compare with no attempt limit at all.
//
// Overridable because the e2e suite signs in far more than 20 times from
// 127.0.0.1 in a single run, so with the production numbers everything
// after roughly the 20th login fails — and it fails as CredentialsSignin,
// indistinguishable from a wrong password, which sends you looking for an
// authentication bug that isn't there. Raising the ceiling in e2e/.env.test
// keeps the limiter itself on the code path (it is still consulted, still
// counts, and its own unit tests cover the boundary) rather than stubbing
// it out. Unset everywhere else, which is what production and dev run.
const limitFromEnv = (name: string, fallback: number) => {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

// Per IP, and Vietnamese mobile carriers put many subscribers behind one
// shared address (CGNAT), as do venue and office wifi: the IP limit is a ceiling
// against scripted abuse, set high enough not to lock out real people who
// happen to share an IP. Tight per-person limits live on the email/account.
// Password guessing on one account is held by LOGIN_EMAIL_RATE_LIMIT.
const LOGIN_IP_RATE_LIMIT = {
  max: limitFromEnv("LOGIN_IP_RATE_LIMIT_MAX", 100),
  windowMs: 10 * 60 * 1000,
};
const LOGIN_EMAIL_RATE_LIMIT = {
  max: limitFromEnv("LOGIN_EMAIL_RATE_LIMIT_MAX", 8),
  windowMs: 10 * 60 * 1000,
};

/**
 * Signals a correct password on an account whose email is still
 * unverified, so the login page can show the resend prompt rather than
 * "wrong email or password". The code itself lives in lib/auth-errors.ts
 * so the login page can read it without importing this server module.
 */
class EmailNotVerifiedError extends CredentialsSignin {
  code = EMAIL_NOT_VERIFIED_CODE;
}

class AccountSuspendedError extends CredentialsSignin {
  code = ACCOUNT_SUSPENDED_CODE;
}

const {
  handlers,
  auth: uncachedAuth,
  signIn,
  signOut,
} = NextAuth({
  adapter: PrismaAdapter(db),
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  pages: {
    signIn: "/login",
    // Any other sign-in failure (e.g. a suspended account via Google, which
    // the signIn callback refuses) comes back to our own login page with
    // ?error=…, instead of Auth.js's untranslated default error page.
    error: "/login",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials, request) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const ip = getClientIp(request);
        if (!checkRateLimit(`login-ip:${ip}`, LOGIN_IP_RATE_LIMIT).allowed) {
          return null;
        }
        if (
          !checkRateLimit(
            `login-email:${parsed.data.email}`,
            LOGIN_EMAIL_RATE_LIMIT,
          ).allowed
        ) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user?.passwordHash || user.deletedAt) return null;

        const isValid = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash,
        );
        if (!isValid) return null;

        // Checked only after the password verifies, so the distinct error
        // below can't be used to test whether an address is registered —
        // you have to already know the password to see it.
        //
        // Thrown rather than returned as null so the login page can offer
        // "resend the link" instead of the misleading "wrong email or
        // password". @auth/core puts `code` in the redirect query string
        // (?error=CredentialsSignin&code=email_not_verified); it's a
        // deliberate, non-sensitive disclosure to someone holding valid
        // credentials for the account.
        // Checked here, after the password, rather than only in the signIn
        // callback: a callback refusal becomes AccessDenied on Auth.js's own
        // English error page, which said nothing about why.
        if (user.isSuspended) {
          throw new AccountSuspendedError();
        }

        if (!user.emailVerified) {
          throw new EmailNotVerifiedError();
        }

        return {
          id: user.id,
          email: user.email,
          name:
            user.name ??
            (joinVietnameseName(user.firstName, user.lastName) || user.email),
          avatar: user.avatar,
        };
      },
    }),
  ],
  callbacks: {
    // Explicit same-origin check for the `callbackUrl` NextAuth's signIn()
    // redirects to after login — `login-form.tsx`/`social-row.tsx` read it
    // straight from the URL query string, so without this an attacker
    // could send someone `/login?callbackUrl=https://evil.com` and land
    // them there, still logged in, right after authenticating. Auth.js's
    // own built-in default already restricts this to same-origin, so this
    // isn't fixing an active bypass today — it's making that guarantee
    // explicit and impossible to accidentally lose (e.g. the moment
    // someone adds role-based post-login routing here and this callback
    // stops being a no-op-passthrough of the safe default).
    redirect({ url, baseUrl }) {
      if (url.startsWith("/") && !url.startsWith("//")) {
        return `${baseUrl}${url}`;
      }
      try {
        if (new URL(url).origin === baseUrl) return url;
      } catch {
        // Not a parseable absolute URL — fall through to baseUrl below.
      }
      return baseUrl;
    },
    async signIn({ user, account }) {
      const dbUser = await db.user.findUnique({ where: { id: user.id } });

      // Checked for every provider — a suspended user shouldn't be able to
      // sign back in via Google just because credentials login is blocked.
      // Doesn't revoke an already-active session (JWT strategy has no
      // server-side store to revoke from — see docs/DEVELOPMENT.md's
      // technical debt register), only blocks new sign-ins from here on.
      if (dbUser?.isSuspended) return false;

      // Accounts made before sign-up assigned usernames, and OAuth accounts
      // (created by the adapter), get one here; a no-op when it is set.
      if (dbUser && !dbUser.username) {
        await assignUsernameIfMissing(dbUser.id);
      }

      // OAuth providers already verify email ownership; only gate credentials login.
      if (account?.provider !== "credentials") return true;

      return Boolean(dbUser?.emailVerified);
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id!;
        token.avatar = (user as { avatar?: string | null }).avatar ?? null;
      }

      // Roles and the display name used to be read from the database in the
      // session callback, which meant one round trip on EVERY request —
      // measured at 4 statements and ~340ms against the pooled connection,
      // paid again by each of the three endpoints the header polls.
      //
      // They live in the token now and are refreshed on a timer instead. The
      // original reason for not doing this was that a role change had to show
      // up without a re-login; a 60-second window keeps that true in practice
      // while taking the query off the hot path. `session.update()` from the
      // client forces it immediately, which is what the roles screen does.
      const synced = typeof token.syncedAt === "number" ? token.syncedAt : 0;
      const stale = Date.now() - synced > SESSION_SYNC_MS;
      if (token.id && (stale || trigger === "update")) {
        // Anything thrown from this callback is an Auth.js "Configuration"
        // error: the request lands on /api/auth/error and the user is, for
        // all practical purposes, signed out — by a refresh that was only
        // meant to top up two cached fields they already have. A database
        // blip under load is exactly when that is least acceptable. Keep the
        // existing (slightly stale) values instead and leave syncedAt alone
        // so the next request tries again. Reproduced as a real flake: the
        // e2e suite's parallel logins hit /api/auth/error intermittently.
        try {
          const account = await db.user.findUnique({
            where: { id: token.id },
            select: {
              name: true,
              firstName: true,
              username: true,
              roles: { where: { active: true }, select: { role: true } },
              profiles: {
                where: { role: { in: PAID_ROLES } },
                select: { displayName: true, role: true },
              },
            },
          });
          token.roles = account?.roles.map((r) => r.role) ?? [];
          token.displayName = account
            ? resolvePartyName(account, (token.name as string) ?? "")
            : ((token.name as string) ?? "");
          token.syncedAt = Date.now();
        } catch (error) {
          console.error(
            "[auth] session refresh failed, keeping cached token",
            error,
          );
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.avatar = token.avatar;
      session.user.roles = (token.roles as Role[] | undefined) ?? [];
      // Public display name (Profile.displayName) — the same name the public
      // profile and chat show. The account holder's personal name stays in
      // the database for admin, billing and verification.
      if (token.displayName) {
        session.user.name = token.displayName as string;
      }

      return session;
    },
  },
});

// auth() is still request-memoized: next-auth does not do it itself, and a
// layout plus a page both calling auth() should decode the token once. The
// database read it used to share is now in the jwt callback behind
// SESSION_SYNC_MS.
export const auth = cache(uncachedAuth);
export { handlers, signIn, signOut };
