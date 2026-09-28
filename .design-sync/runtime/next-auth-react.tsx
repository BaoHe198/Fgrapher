// Design-sync shim for next-auth/react: designs render signed out unless a
// preview passes its own data; sign-in actions are no-ops.
import type { ReactNode } from "react";

export function useSession() {
  return { data: null, status: "unauthenticated" as const, update: async () => null };
}
export async function signIn() {
  return undefined;
}
export async function signOut() {
  return undefined;
}
export function SessionProvider({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}
