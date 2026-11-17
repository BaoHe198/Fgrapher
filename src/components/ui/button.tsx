import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Fgrapher brand variants. System audit 09/2026: hover lifts 1px with a
// shadow and shifts the fill (never opacity, which muddies dark mode); press
// shrinks to 0.98 in 150ms; focus is the shared 2px gold ring. Secondary is
// a sunken fill with no border so it no longer duplicates outline. Under
// reduced motion only the colours change.
const buttonVariants = cva(
  "group/button inline-flex cursor-pointer shrink-0 items-center justify-center gap-1.5 rounded-[var(--fg-radius-sm)] border border-transparent bg-clip-padding font-semibold tracking-[0.04em] whitespace-nowrap uppercase transition-[color,background-color,border-color,box-shadow,transform,scale,opacity] duration-[var(--fg-dur-150)] ease-fg-out outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus active:not-aria-[haspopup]:scale-[0.98] motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-50 data-disabled:cursor-not-allowed data-disabled:opacity-50 aria-invalid:border-danger [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          "bg-brand-primary text-text-on-brand hover:-translate-y-px hover:bg-brand-primary-hover hover:shadow-[var(--shadow-md)]",
        // White text, as on Sentry's purple "Sign in" (owner, 17/11/2026).
        // Forced with `!`: rendered as a link, some containers colour their
        // links (the header did), which turned the label dark on purple.
        accent:
          "bg-gold-400 text-white! hover:-translate-y-px hover:bg-gold-500 hover:shadow-[var(--shadow-md)]",
        secondary:
          "bg-neutral-100 text-text-primary hover:-translate-y-px hover:bg-neutral-200 hover:shadow-[var(--shadow-sm)]",
        ghost: "text-text-secondary hover:bg-bg-sunken hover:text-text-primary",
        outline:
          "border-2 border-border-strong bg-transparent text-text-primary hover:-translate-y-px hover:border-border-focus hover:bg-bg-sunken hover:shadow-[var(--shadow-sm)] dark:border-gold-300",
        destructive:
          "bg-danger-bg text-danger hover:-translate-y-px hover:bg-[color-mix(in_oklab,var(--danger-bg),var(--danger)_14%)] hover:shadow-[var(--shadow-sm)]",
        link: "tracking-normal normal-case text-text-link underline-offset-4 hover:text-text-primary hover:underline",
      },
      size: {
        sm: "px-3 py-[7px] text-meta",
        md: "px-4 py-2.5 text-body-sm",
        lg: "px-6 py-3.5 text-body-md",
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
