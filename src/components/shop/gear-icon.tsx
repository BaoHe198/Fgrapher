import {
  Aperture,
  Cable,
  Camera,
  Grip,
  Lightbulb,
  type LucideProps,
  Mic,
  Package,
} from "lucide-react";

import { normalizeProductCategory } from "@/lib/validations/product";

// One line icon per equipment category (wave 2 Chợ F): the category tiles,
// and the "Chưa có ảnh" frame of a listing without photos - which shows
// what kind of thing is missing rather than a generic picture.
const ICONS = {
  "Camera body": Camera,
  Lens: Aperture,
  Lighting: Lightbulb,
  Audio: Mic,
  Support: Grip,
  Accessory: Cable,
  Other: Package,
} as const;

export function GearIcon({
  category,
  ...props
}: { category: string } & LucideProps) {
  const Icon =
    ICONS[normalizeProductCategory(category) as keyof typeof ICONS] ?? Package;
  return <Icon aria-hidden strokeWidth={1.25} {...props} />;
}
