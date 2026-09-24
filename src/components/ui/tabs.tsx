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
      // than the viewport instead of scrolling in place. The native
      // scrollbar this produces is the overflow cue — deliberately not
      // hidden. overflow-y-hidden matters: overflow-x-auto alone makes
      // the y axis scrollable too, the active tab's underline pokes a pixel
      // past the bottom, and with always-visible scrollbars a two-tab row
      // grew a vertical AND a horizontal scrollbar (Cộng đồng F, 24/09).
      className={cn(
        "flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border-subtle",
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
