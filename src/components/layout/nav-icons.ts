import {
  Bell,
  Bookmark,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  Home,
  LayoutGrid,
  type LucideIcon,
  MessageCircle,
  Package,
  Pin,
  Plus,
  Settings,
  Shield,
  ShoppingBag,
  UserRound,
} from "lucide-react";

import type { NavIcon } from "@/lib/dashboard-nav";

/**
 * Icons for lib/dashboard-nav.ts's items. A plain module (no "use client")
 * so server pages such as "Tiện ích khác" can use the same map as the
 * client-side menu.
 */
export const NAV_ICON_COMPONENTS: Record<NavIcon, LucideIcon> = {
  today: Home,
  calendar: CalendarDays,
  bookings: CalendarCheck,
  messages: MessageCircle,
  jobs: Briefcase,
  myPage: UserRound,
  shop: ShoppingBag,
  more: LayoutGrid,
  settings: Settings,
  admin: Shield,
  requests: ClipboardList,
  newRequest: Plus,
  saved: Bookmark,
  moodboard: Pin,
  orders: Package,
  notifications: Bell,
};
