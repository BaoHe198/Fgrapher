import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      avatar: string | null;
      roles: Role[];
    } & DefaultSession["user"];
  }

  interface User {
    avatar?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    avatar: string | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    avatar: string | null;
  }
}
