"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { MAX_VND_DIGITS } from "@/lib/validations/money";

import { fieldControlClass } from "./field-control";

// Value/onChange carry the raw digit string (e.g. "1000000"), matching what
// callers store and eventually send to the API — this component only owns
// the display formatting (thousands separators + "₫" suffix), never the
// underlying numeric value.
interface CurrencyInputProps extends Omit<
  React.ComponentProps<"input">,
  "value" | "onChange" | "type"
> {
  label?: string;
  error?: string;
  value: string;
  onChange: (digits: string) => void;
}

function CurrencyInput({
  className,
  label,
  error,
  value,
  onChange,
  id,
  "aria-invalid": ariaInvalid,
  ...props
}: CurrencyInputProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const formatted = value
    ? new Intl.NumberFormat("vi-VN").format(Number(value))
    : "";

  const input = (
    <div className="relative">
      <input
        id={inputId}
        type="text"
        inputMode="numeric"
        data-slot="input"
        value={formatted}
        // Capped at MAX_VND_DIGITS: a caret left mid-number used to let a
        // retyped price append to the old one (45.000.000 + 44000000).
        onChange={(e) =>
          onChange(e.target.value.replace(/\D/g, "").slice(0, MAX_VND_DIGITS))
        }
        aria-invalid={ariaInvalid ?? Boolean(error)}
        className={cn(fieldControlClass, "pr-9", className)}
        {...props}
      />
      <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-body-md text-text-tertiary">
        ₫
      </span>
    </div>
  );

  if (!label && !error) return input;

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label
          htmlFor={inputId}
          className="text-body-sm font-semibold! text-text-primary"
        >
          {label}
        </label>
      ) : null}
      {input}
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
    </div>
  );
}

export { CurrencyInput };
