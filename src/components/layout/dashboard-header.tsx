"use client";

import type { Role } from "@prisma/client";
import { Bell, Search } from "lucide-react";
import { useState } from "react";

import { MobileNav } from "@/components/layout/mobile-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABELS } from "@/lib/constants";

interface DashboardHeaderProps {
  roles: Role[];
  user: {
    name: string;
    email: string;
    avatar: string | null;
  };
  unreadNotifications?: number;
}

export function DashboardHeader({
  roles,
  user,
  unreadNotifications = 0,
}: DashboardHeaderProps) {
  const [activeRole, setActiveRole] = useState<Role>(roles[0] ?? "CUSTOMER");

  return (
    <header className="flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/60 sm:px-6">
      <MobileNav roles={roles} user={user} />

      <div className="relative flex-1 max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search Fgrapher..." className="pl-8" />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {roles.length > 1 ? (
          <Select
            value={activeRole}
            onValueChange={(value) => setActiveRole(value as Role)}
          >
            <SelectTrigger size="sm" className="hidden sm:flex">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-5" />
          {unreadNotifications > 0 ? (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 justify-center px-1 text-[10px]">
              {unreadNotifications > 9 ? "9+" : unreadNotifications}
            </Badge>
          ) : null}
          <span className="sr-only">Notifications</span>
        </Button>
      </div>
    </header>
  );
}
