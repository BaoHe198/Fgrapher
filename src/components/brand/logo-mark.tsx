"use client";

import { useTheme } from "next-themes";

import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";

interface LogoMarkProps {
  size?: number;
  className?: string;
}

export function LogoMark({ size = 28, className }: LogoMarkProps) {
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={cn(className)}
      aria-hidden="true"
    >
      <rect
        x="20"
        y="20"
        width="120"
        height="120"
        rx="18"
        fill="none"
        stroke={isDark ? "#F7F1E6" : "#123832"}
        strokeWidth="14"
      />
      <rect
        x="60"
        y="60"
        width="120"
        height="120"
        rx="18"
        fill="none"
        stroke="#C9A66B"
        strokeWidth="14"
        style={isDark ? undefined : { mixBlendMode: "multiply" }}
      />
    </svg>
  );
}
