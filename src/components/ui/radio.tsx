"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

interface RadioProps extends Omit<React.ComponentProps<"input">, "type" | "size"> {
  label?: React.ReactNode;
}

function Radio({ className, id, label, checked, disabled, ...props }: RadioProps) {
  const generatedId = React.useId();
  const radioId = id ?? generatedId;

  const dot = (
    <span className="relative inline-flex size-[18px] shrink-0 items-center justify-center">
      <input
        id={radioId}
        type="radio"
        checked={checked}
        disabled={disabled}
        className="peer absolute inset-0 m-0 size-full cursor-pointer appearance-none rounded-full border border-border-default bg-bg-surface outline-none transition-colors checked:border-brand-primary focus-visible:ring-2 focus-visible:ring-gold-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute size-2 scale-0 rounded-full bg-brand-primary transition-transform peer-checked:scale-100",
          className,
        )}
      />
    </span>
  );

  if (!label) return dot;

  return (
    <label
      htmlFor={radioId}
      className={cn(
        "inline-flex items-center gap-2.5",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      )}
    >
      {dot}
      <span className="text-body-md text-text-primary">{label}</span>
    </label>
  );
}

export { Radio };
