"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";

import { cn } from "@/lib/utils";
import { CheckIcon } from "lucide-react";

interface CheckboxProps extends CheckboxPrimitive.Root.Props {
  label?: React.ReactNode;
}

function Checkbox({ className, id, label, ...props }: CheckboxProps) {
  const generatedId = React.useId();
  const checkboxId = id ?? generatedId;

  const box = (
    <CheckboxPrimitive.Root
      id={checkboxId}
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-[18px] shrink-0 items-center justify-center rounded-[var(--fg-radius-sm)] border border-border-default bg-bg-surface transition-colors outline-none group-has-disabled/field:opacity-50 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-border-focus focus-visible:ring-2 focus-visible:ring-gold-500/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-2 aria-invalid:ring-danger/20 data-checked:border-brand-primary data-checked:bg-brand-primary data-checked:text-text-on-brand",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3"
      >
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );

  if (!label) return box;

  return (
    <label htmlFor={checkboxId} className="inline-flex cursor-pointer items-center gap-2">
      {box}
      <span className="text-body-sm text-text-secondary">{label}</span>
    </label>
  );
}

export { Checkbox };
