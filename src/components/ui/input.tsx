import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

// React 19 forwards `ref` as a normal prop on function components — no
// React.forwardRef wrapper needed for react-hook-form's register() to reach
// the underlying <input>; already confirmed working end-to-end (phase-0
// register/login forms use {...register(...)} on this component).
interface InputProps extends React.ComponentProps<"input"> {
  label?: string
  error?: string
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
  const generatedId = React.useId()
  const inputId = id ?? generatedId

  const input = (
    <InputPrimitive
      id={inputId}
      type={type}
      data-slot="input"
      aria-invalid={ariaInvalid ?? Boolean(error)}
      className={cn(
        "h-auto w-full min-w-0 rounded-[var(--fg-radius-md)] border border-border-default bg-bg-surface px-3.5 py-2.5 text-body-md text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus-visible:border-border-focus focus-visible:ring-2 focus-visible:ring-gold-500/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  )

  if (!label && !error) return input

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={inputId} className="text-body-sm font-semibold text-text-primary">
          {label}
        </label>
      ) : null}
      {input}
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
    </div>
  )
}

export { Input }
