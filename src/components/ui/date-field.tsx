"use client";

import { CalendarDays } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Input } from "@/components/ui/input";
import {
  commitFromDisplay,
  isoToDisplay,
  maskDateInput,
} from "@/lib/date-input";
import { cn } from "@/lib/utils";

interface DateFieldProps {
  /** "yyyy-MM-dd", or "" for empty — the same value a native date input has. */
  value: string;
  /** Called with a complete "yyyy-MM-dd", or "" when the field is cleared. */
  onChange: (value: string) => void;
  label?: string;
  error?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
}

/**
 * A date field that always reads dd/mm/yyyy.
 *
 * Replaces <input type="date">, whose text is formatted by the *browser's UI
 * language* — so the same Vietnamese page shows "13/09/2026" to someone on a
 * Vietnamese Chrome and "09/13/2026" to someone on an English one, with
 * nothing on screen to tell the two apart. `lang="vi"` doesn't change it.
 *
 * What the user sees and types is ours (see lib/date-input.ts). What pops up
 * when they press the calendar button is still the operating system's own
 * picker, driven by a hidden native input: rebuilding that would mean
 * rebuilding a mobile date wheel, and the OS one is better than anything
 * worth writing here. Its *display* format never shows, so its locale
 * doesn't matter — only the yyyy-MM-dd value it hands back does.
 */
export function DateField({
  value,
  onChange,
  label,
  error,
  min,
  max,
  disabled,
  className,
  id,
  name,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: DateFieldProps) {
  const t = useTranslations("uiKit.dateField");
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const pickerRef = React.useRef<HTMLInputElement>(null);

  const [text, setText] = React.useState(() => isoToDisplay(value));

  // Adjusting state during render, not in an effect: when the parent changes
  // `value` underneath us (a reset, a clamp, a form load) the text has to
  // follow. React re-runs this component before touching the DOM, so there's
  // no intermediate paint showing the stale text.
  const [lastValue, setLastValue] = React.useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(isoToDisplay(value));
  }

  const handleText = (raw: string, isDeleting: boolean) => {
    const masked = maskDateInput(raw, isDeleting);
    setText(masked);

    const committed = commitFromDisplay(masked);
    // null = still mid-date; hold the previous value rather than flickering
    // through the partial years the user is typing past.
    if (committed !== null && committed !== value) {
      onChange(committed);
    }
  };

  const handleBlur = () => {
    // Whatever is on screen when focus leaves must be the value the form
    // holds — otherwise someone types "13/0" and walks away believing they
    // picked a date.
    if (commitFromDisplay(text) === null) {
      setText(isoToDisplay(value));
    }
  };

  const openPicker = () => {
    const picker = pickerRef.current;
    if (!picker) return;
    try {
      picker.showPicker();
    } catch {
      // Older browsers, or a picker the engine refuses to open
      // programmatically. Focusing at least puts the user in the field.
      picker.focus();
    }
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label
          htmlFor={inputId}
          className="text-body-sm font-semibold! text-text-primary"
        >
          {label}
        </label>
      ) : null}

      <div className="relative">
        <Input
          id={inputId}
          name={name}
          value={text}
          disabled={disabled}
          // The placeholder is doing real work here: it's the only thing that
          // tells a user which of the two orders this field wants.
          placeholder={t("placeholder")}
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid ?? Boolean(error)}
          className="pr-11"
          onChange={(event) => {
            // A deletion must not have the separator immediately re-added, or
            // backspace stops at "13/09/" forever.
            const nativeEvent = event.nativeEvent as InputEvent;
            handleText(
              event.target.value,
              typeof nativeEvent.inputType === "string" &&
                nativeEvent.inputType.startsWith("delete"),
            );
          }}
          onBlur={handleBlur}
        />

        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          // The visible field is the one that carries the label, so this
          // button needs its own name for screen readers.
          aria-label={t("openPicker")}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-[var(--fg-radius-md)] text-text-tertiary transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-gold-500/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CalendarDays className="size-4" />
        </button>

        {/* The OS picker's anchor. Rendered (not display:none — showPicker()
            needs a laid-out element) but invisible and out of the tab order:
            the button above opens it, and the text input above is where
            keyboard users type. */}
        <input
          ref={pickerRef}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="pointer-events-none absolute inset-y-0 right-4 w-px opacity-0"
        />
      </div>

      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
    </div>
  );
}
