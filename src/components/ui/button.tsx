import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Fgrapher brand variants: primary/accent/secondary/ghost match the design
// exactly (phase-1 Step 4). outline/destructive/link are kept, restyled with
// brand tokens, because existing call sites and shadcn's own generated
// components (sheet/dialog/toast/calendar) already depend on them.
const buttonVariants = cva(
  "group/button inline-flex cursor-pointer shrink-0 items-center justify-center gap-1.5 rounded-[var(--fg-radius-md)] border border-transparent bg-clip-padding font-semibold whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-150 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 data-disabled:cursor-not-allowed data-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          "bg-brand-primary text-text-on-brand hover:-translate-y-px hover:opacity-90 hover:shadow-[var(--shadow-md)]",
        // text-gold-900, not text-neutral-900: the neutral scale flips in
        // dark mode while gold does not, so neutral-900 turned near-white
        // on the unchanged gold fill (contrast ~2:1).
        accent:
          "bg-gold-400 text-gold-900 hover:-translate-y-px hover:bg-gold-500 hover:shadow-[var(--shadow-md)]",
        secondary:
          "bg-bg-surface border-border-default text-text-primary hover:-translate-y-px hover:border-border-focus hover:bg-bg-sunken hover:shadow-[var(--shadow-sm)]",
        ghost: "text-text-secondary hover:bg-bg-sunken hover:text-text-primary",
        outline:
          "bg-bg-surface border-border-default text-text-primary hover:-translate-y-px hover:border-border-focus hover:bg-bg-sunken hover:shadow-[var(--shadow-sm)]",
        destructive:
          "bg-danger-bg text-danger hover:-translate-y-px hover:opacity-90 hover:shadow-[var(--shadow-sm)]",
        link: "text-text-link underline-offset-4 hover:text-text-primary hover:underline",
      },
      size: {
        sm: "px-3 py-[7px] text-body-sm",
        md: "px-4 py-2.5 text-body-md",
        lg: "px-6 py-3.5 text-body-lg",
        icon: "size-10 px-0 py-0",
        "icon-sm": "size-8 px-0 py-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
