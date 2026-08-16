import type { Role } from "@prisma/client";
import { Aperture } from "lucide-react";
import Link from "next/link";

import { SidebarNav } from "@/components/layout/sidebar-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { cn } from "@/lib/utils";

interface SidebarProps {
  roles: Role[];
  user: {
    name: string;
    email: string;
    avatar: string | null;
  };
  className?: string;
}

export function Sidebar({ roles, user, className }: SidebarProps) {
  return (
    <div className={cn("flex h-full flex-col gap-6 p-4", className)}>
      <Link
        href="/dashboard"
        className="flex items-center gap-2 px-2 text-lg font-semibold tracking-tight"
      >
        <Aperture className="size-6 text-primary" />
        Fgrapher
      </Link>

      <div className="flex-1 overflow-y-auto">
        <SidebarNav roles={roles} />
      </div>

      <UserMenu name={user.name} email={user.email} avatar={user.avatar} />
    </div>
  );
}
