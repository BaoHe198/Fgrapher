"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type NativeSelectOption = string | { value: string; label: string };

interface NativeSelectProps
  extends Omit<React.ComponentProps<"select">, "value" | "onChange"> {
  label?: string;
  error?: string;
  options: NativeSelectOption[];
  value?: string;
  onChange?: (value: string) => void;
}

function NativeSelect({
  className,
  label,
  error,
  options,
  value,
  onChange,
  id,
  "aria-invalid": ariaInvalid,
  ...props
}: NativeSelectProps) {
  const generatedId = React.useId();
  const selectId = id ?? generatedId;

  const select = (
    <div className="relative">
      <select
        id={selectId}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        aria-invalid={ariaInvalid ?? Boolean(error)}
        className={cn(
          "h-auto w-full min-w-0 appearance-none rounded-[var(--fg-radius-md)] border border-border-default bg-bg-surface px-3.5 py-2.5 pr-10 text-body-md text-text-primary outline-none transition-colors focus-visible:border-border-focus focus-visible:ring-2 focus-visible:ring-gold-500/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger",
          className,
        )}
        {...props}
      >
        {options.map((option) => {
          const opt = typeof option === "string" ? { value: option, label: option } : option;
          return (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          );
        })}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-text-tertiary" />
    </div>
  );

  if (!label && !error) return select;

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={selectId} className="text-body-sm font-semibold text-text-primary">
          {label}
        </label>
      ) : null}
      {select}
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
    </div>
  );
}

export { NativeSelect };
