"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      // overflow-x-auto + each TabsTab pinned to shrink-0 below — a tab
      // row with enough tabs/labels to exceed a narrow viewport (5 status
      // tabs on /admin/reports, /dashboard/bookings, /dashboard/
      // notifications, ...) used to just push the whole document wider
      // than the viewport instead of scrolling in place.
      //
      // The scrollbar itself is hidden. It was kept as an overflow cue, but
      // browsers set to always show scrollbars (Safari, Chrome on macOS with
      // a mouse) drew one under rows that fit — a sub-pixel rounding of the
      // label widths is enough — so a two-tab row like Khám phá / Đang theo
      // dõi grew a scrollbar (24–25/09 reports). The row still scrolls by
      // swipe, trackpad and shift+wheel, like a phone app's tab bar; on
      // phones the right edge fades out instead, so a tab running past it
      // reads as "there is more this way".
      className={cn(
        "flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border-subtle [scrollbar-width:none] max-sm:[mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      {...props}
    />
  );
}

function TabsTab({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-tab"
      className={cn(
        "shrink-0 cursor-pointer rounded-t-md border-b-2 border-transparent px-4 py-3 text-body-md font-semibold! text-text-secondary transition-colors duration-150 hover:bg-bg-sunken hover:text-text-primary data-active:border-brand-primary data-active:bg-bg-sunken/70 data-active:text-text-primary",
        className,
      )}
      {...props}
    />
  );
}

function TabsPanel({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-panel"
      className={cn(className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTab, TabsPanel };
