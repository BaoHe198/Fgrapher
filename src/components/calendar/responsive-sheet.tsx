"use client";

import type { ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-is-mobile";

interface ResponsiveSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Pinned under the scrolling body: the primary actions. */
  footer?: ReactNode;
}

/**
 * The calendar's panels (add a job, a job's details, reminders). On a phone
 * they rise from the bottom, where the thumb already is, and stop short of
 * the top so the day behind stays visible; on a wide screen they slide in
 * from the right and leave the month grid readable. The body scrolls, the
 * title and the buttons do not — the save button must not scroll away under
 * a long form with the keyboard up.
 */
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: ResponsiveSheetProps) {
  const isMobile = useIsMobile();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="pr-14">
          <SheetTitle>{title}</SheetTitle>
          {description ? (
            <SheetDescription>{description}</SheetDescription>
          ) : null}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {children}
        </div>
        {footer ? (
          <SheetFooter className="border-t border-border-subtle pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
