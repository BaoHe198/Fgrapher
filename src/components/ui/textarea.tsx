"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

import { fieldControlClass } from "./field-control";

// Same control styling as Input (field-control.ts) and the same optional
// label/error wrapper, plus a hint line and an opt-in character counter
// (`showCount` with `maxLength`). Without label/error/hint/showCount it
// renders the bare <textarea>, so existing call sites that compose their own
// label keep their layout.
interface TextareaProps extends React.ComponentProps<"textarea"> {
  label?: string;
  error?: string;
  hint?: string;
  showCount?: boolean;
}

function Textarea({
  className,
  label,
  error,
  hint,
  showCount = false,
  id,
  maxLength,
  onChange,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  ...props
}: TextareaProps) {
  const generatedId = React.useId();
  const textareaId = id ?? generatedId;
  const hintId = `${textareaId}-hint`;
  const errorId = `${textareaId}-error`;

  const initialLength = String(props.value ?? props.defaultValue ?? "").length;
  const [uncontrolledLength, setUncontrolledLength] =
    React.useState(initialLength);
  const length =
    props.value !== undefined ? String(props.value).length : uncontrolledLength;
  const counting = showCount && maxLength !== undefined;

  const describedBy =
    [ariaDescribedBy, hint ? hintId : null, error ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  const textarea = (
    <textarea
      id={textareaId}
      data-slot="textarea"
      maxLength={maxLength}
      aria-invalid={ariaInvalid ?? Boolean(error)}
      aria-describedby={describedBy}
      onChange={(event) => {
        if (counting) setUncontrolledLength(event.target.value.length);
        onChange?.(event);
      }}
      className={cn(
        fieldControlClass,
        "flex field-sizing-content min-h-20",
        className,
      )}
      {...props}
    />
  );

  if (!label && !error && !hint && !counting) return textarea;

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label
          htmlFor={textareaId}
          className="text-body-sm font-semibold! text-text-primary"
        >
          {label}
        </label>
      ) : null}
      {textarea}
      {hint || error || counting ? (
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            {error ? (
              <p id={errorId} className="text-body-sm text-danger">
                {error}
              </p>
            ) : null}
            {hint ? (
              <p id={hintId} className="text-body-sm text-text-tertiary">
                {hint}
              </p>
            ) : null}
          </div>
          {counting ? (
            <span
              aria-live="polite"
              className={cn(
                "shrink-0 text-meta tabular-nums text-text-tertiary",
                length >= maxLength && "text-danger",
              )}
            >
              {length}/{maxLength}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export { Textarea };
