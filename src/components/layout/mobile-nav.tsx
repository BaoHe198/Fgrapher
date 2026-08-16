"use client";

import type { Role } from "@prisma/client";
import { Menu } from "lucide-react";
import { useState } from "react";

import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface MobileNavProps {
  roles: Role[];
  user: {
    name: string;
    email: string;
    avatar: string | null;
  };
}

export function MobileNav({ roles, user }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="size-5" />
            <span className="sr-only">Open navigation</span>
          </Button>
        }
      />
      <SheetContent side="left" className="w-3/4 p-0 sm:max-w-xs">
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>Main site navigation</SheetDescription>
        </SheetHeader>
        <Sidebar roles={roles} user={user} className="h-full" />
      </SheetContent>
    </Sheet>
  );
}
