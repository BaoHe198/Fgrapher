import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

interface TagProps extends ComponentProps<"button"> {
  selected?: boolean;
}

function Tag({
  selected = false,
  className,
  type = "button",
  ...props
}: TagProps) {
  return (
    <button
      type={type}
      data-slot="tag"
      data-selected={selected}
      className={cn(
        "cursor-pointer rounded-full border px-3.5 py-2 text-body-sm font-semibold transition-colors duration-150",
        selected
          ? "border-transparent bg-brand-primary text-text-on-brand"
          : "border-border-default bg-bg-surface text-text-secondary",
        className,
      )}
      {...props}
    />
  );
}

export { Tag };
