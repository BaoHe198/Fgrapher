import Link from "next/link";

import { LogoMark } from "@/components/brand/logo-mark";
import { cn } from "@/lib/utils";

interface LogoFullProps {
  size?: number;
  className?: string;
  href?: string;
}

export function LogoFull({ size = 28, className, href = "/" }: LogoFullProps) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2.5", className)}
    >
      <LogoMark size={size} />
      <span className="text-heading-lg text-text-primary">Fgrapher</span>
    </Link>
  );
}
