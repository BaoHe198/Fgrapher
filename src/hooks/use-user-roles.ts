import type { Role } from "@prisma/client";
import { useSession } from "next-auth/react";

import { PORTFOLIO_ROLES, PROVIDER_ROLES, SELLER_ROLES } from "@/lib/constants";

export function useUserRoles() {
  const { data: session, status } = useSession();
  const roles = session?.user?.roles ?? [];

  return {
    roles,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
    hasRole: (role: Role) => roles.includes(role),
    isPaid: roles.some((role) => role !== "CUSTOMER" && role !== "ADMIN"),
    isCustomerOnly: roles.length === 1 && roles[0] === "CUSTOMER",
    canUpload: roles.some((role) => PORTFOLIO_ROLES.includes(role)),
    canSell: SELLER_ROLES.some((role) => roles.includes(role)),
    canReceiveBookings: roles.some((role) =>
      (PROVIDER_ROLES as Role[]).includes(role),
    ),
  };
}
