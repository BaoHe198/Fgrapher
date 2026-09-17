import * as React from "react";

import { cn } from "@/lib/utils";

function Card({
  className,
  size = "default",
  padding = true,
  interactive = false,
  ...props
}: React.ComponentProps<"div"> & {
  size?: "default" | "sm";
  /** Adds pointer, focus, hover and pressed feedback when the card is clickable. */
  interactive?: boolean;
  /** Fgrapher brand prop (phase-1 Step 4): false removes all section padding
   * (--card-spacing), for cards whose content — e.g. a flush cover image —
   * needs to reach the card's edges. Existing CardHeader/CardContent/
   * CardFooter still derive their padding from --card-spacing either way. */
  padding?: boolean;
}) {
  const isInteractive =
    interactive ||
    typeof props.onClick === "function" ||
    props.role === "button";

  return (
    <div
      data-slot="card"
      data-size={size}
      data-interactive={isInteractive || undefined}
      className={cn(
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-[var(--fg-radius-lg)] bg-surface-card px-(--card-spacing) py-(--card-spacing) text-sm text-text-primary shadow-[var(--shadow-sm)] [--card-spacing:--spacing(5)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-[var(--fg-radius-lg)] *:[img:last-child]:rounded-b-[var(--fg-radius-lg)]",
        isInteractive &&
          "cursor-pointer border border-border-subtle transition-[border-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-border-focus hover:shadow-[var(--shadow-lg)] active:translate-y-0 active:shadow-[var(--shadow-sm)] focus-visible:border-border-focus focus-visible:ring-2 focus-visible:ring-gold-500/30 focus-visible:outline-none",
        !padding && "[--card-spacing:--spacing(0)]",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-[var(--fg-radius-lg)] px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className,
      )}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-text-secondary", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className,
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-[var(--fg-radius-lg)] border-t bg-bg-sunken p-(--card-spacing)",
        className,
      )}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};
