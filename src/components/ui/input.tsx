"use client";

import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { fieldControlClass } from "./field-control";

// React 19 forwards `ref` as a normal prop on function components — no
// React.forwardRef wrapper needed for react-hook-form's register() to reach
// the underlying <input>; already confirmed working end-to-end (phase-0
// register/login forms use {...register(...)} on this component).
interface InputProps extends React.ComponentProps<"input"> {
  label?: string;
  error?: string;
}

function Input({
  className,
  type,
  label,
  error,
  id,
  "aria-invalid": ariaInvalid,
  ...props
}: InputProps) {
  const t = useTranslations("uiKit.passwordInput");
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  // Every password field gets an eye toggle so people can check what they
  // typed (owner, 18/11/2026) — built in here rather than per form, so a new
  // password field can't ship without it.
  const isPassword = type === "password";
  const [revealed, setRevealed] = React.useState(false);

  const control = (
    <InputPrimitive
      id={inputId}
      type={isPassword && revealed ? "text" : type}
      data-slot="input"
      aria-invalid={ariaInvalid ?? Boolean(error)}
      className={cn(fieldControlClass, isPassword && "pr-11", className)}
      {...props}
    />
  );

  const input = isPassword ? (
    <div className="relative">
      {control}
      <button
        type="button"
        onClick={() => setRevealed((value) => !value)}
        aria-label={revealed ? t("hide") : t("show")}
        aria-pressed={revealed}
        aria-controls={inputId}
        className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center rounded-r-[var(--fg-radius-md)] text-text-tertiary transition-colors duration-[var(--fg-dur-150)] outline-none hover:text-text-primary focus-visible:text-text-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus disabled:cursor-not-allowed"
        disabled={props.disabled}
      >
        {revealed ? (
          <EyeOff aria-hidden className="size-4" />
        ) : (
          <Eye aria-hidden className="size-4" />
        )}
      </button>
    </div>
  ) : (
    control
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

export { Input };
