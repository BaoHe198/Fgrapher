"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

interface SwitchProps extends Omit<React.ComponentProps<"input">, "type" | "onChange"> {
  label?: React.ReactNode;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

function Switch({ className, id, label, checked, disabled, onChange, ...props }: SwitchProps) {
  const generatedId = React.useId();
  const switchId = id ?? generatedId;

  const track = (
    <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
      <input
        id={switchId}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
        className="peer absolute inset-0 m-0 size-full cursor-pointer appearance-none rounded-full outline-none disabled:cursor-not-allowed"
        {...props}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 rounded-full bg-neutral-300 transition-colors duration-150 peer-checked:bg-brand-primary peer-focus-visible:ring-2 peer-focus-visible:ring-gold-500/20 peer-disabled:opacity-50",
          className,
        )}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none relative left-0.5 size-5 translate-x-0 rounded-full bg-white shadow-sm transition-transform duration-150 peer-checked:translate-x-5"
      />
    </span>
  );

  if (!label) return track;

  return (
    <label
      htmlFor={switchId}
      className={cn(
        "inline-flex items-center gap-2.5",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      )}
    >
      <span className="text-body-md text-text-primary">{label}</span>
      {track}
    </label>
  );
}

export { Switch };
