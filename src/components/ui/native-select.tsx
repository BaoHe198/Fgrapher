"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { fieldControlClass } from "./field-control";

type NativeSelectOption = string | { value: string; label: string };

interface NativeSelectProps extends Omit<
  React.ComponentProps<"select">,
  "value" | "onChange"
> {
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
          fieldControlClass,
          "cursor-pointer appearance-none pr-10 hover:bg-bg-sunken",
          className,
        )}
        {...props}
      >
        {options.map((option) => {
          const opt =
            typeof option === "string"
              ? { value: option, label: option }
              : option;
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
        <label
          htmlFor={selectId}
          className="text-body-sm font-semibold! text-text-primary"
        >
          {label}
        </label>
      ) : null}
      {select}
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
    </div>
  );
}

export { NativeSelect };
