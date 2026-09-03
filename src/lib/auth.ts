import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { cache } from "react";

import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validations/auth";

// Two layers: per-IP catches a scripted credential-stuffing loop trying
// many different accounts from one source; per-email catches someone
// brute-forcing (or credential-stuffing) one specific account while
// rotating IPs. Neither existed before — authorize() ran a straight
// bcrypt.compare with no attempt limit at all.
const LOGIN_IP_RATE_LIMIT = { max: 20, windowMs: 10 * 60 * 1000 };
const LOGIN_EMAIL_RATE_LIMIT = { max: 8, windowMs: 10 * 60 * 1000 };

const {
  handlers,
  auth: uncachedAuth,
  signIn,
  signOut,
} = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
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

        return {
          id: user.id,
          email: user.email,
          name:
            user.name ??
            ([user.firstName, user.lastName].filter(Boolean).join(" ") ||
              user.email),
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
      // OAuth providers already verify email ownership; only gate credentials login.
      if (account?.provider !== "credentials") return true;

      const dbUser = await db.user.findUnique({ where: { id: user.id } });
      return Boolean(dbUser?.emailVerified);
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.avatar = (user as { avatar?: string | null }).avatar ?? null;
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.avatar = token.avatar;

      // Fetched per-request (not baked into the JWT at sign-in) so that role
      // changes — onboarding, subscription changes — show up without a re-login.
      const roles = await db.userRole.findMany({
        where: { userId: token.id, active: true },
        select: { role: true },
      });
      session.user.roles = roles.map((r) => r.role);

      return session;
    },
  },
});

// The session callback now hits the DB on every call (see above), and
// next-auth's auth() isn't request-memoized on its own — cache it so a
// layout + page both calling auth() in the same request share one query.
export const auth = cache(uncachedAuth);
export { handlers, signIn, signOut };
