import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { cache } from "react";

import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validations/auth";

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
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

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
