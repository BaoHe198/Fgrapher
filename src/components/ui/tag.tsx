import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { cn } from "@/lib/utils";

interface TagProps extends useRender.ComponentProps<"button"> {
  selected?: boolean;
}

function Tag({ selected = false, className, render, ...props }: TagProps) {
  return useRender({
    defaultTagName: "button",
    render,
    props: mergeProps<"button">(
      {
        type: "button",
        className: cn(
          "cursor-pointer rounded-full border px-3.5 py-2 text-body-sm font-semibold! transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40",
          selected
            ? "border-transparent bg-brand-primary text-text-on-brand"
            : "border-border-default bg-bg-surface text-text-secondary",
          className,
        ),
      },
      props,
    ),
    state: { slot: "tag", selected },
  });
}

export { Tag };
