import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Fgrapher brand tones: success/warning/accent/neutral match the design
// exactly (phase-1 Step 4). default/secondary/destructive/outline/ghost/link
// are kept, restyled with brand tokens, for existing call sites.
const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 py-1 text-body-sm font-semibold whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        success: "bg-success-bg text-success",
        warning: "bg-warning-bg text-warning",
        accent: "bg-gold-100 text-gold-800",
        neutral: "bg-neutral-100 text-neutral-700",
        default: "bg-brand-primary text-text-on-brand [a]:hover:opacity-90",
        secondary: "bg-neutral-100 text-neutral-700 [a]:hover:opacity-90",
        destructive: "bg-danger-bg text-danger [a]:hover:opacity-90",
        outline:
          "border-border-default text-text-primary [a]:hover:bg-bg-sunken",
        ghost: "text-text-secondary hover:bg-bg-sunken",
        link: "text-text-link underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props,
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  });
}

export { Badge, badgeVariants };
