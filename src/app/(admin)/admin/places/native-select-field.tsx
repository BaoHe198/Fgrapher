import { ChevronDown } from "lucide-react";

/** A labelled plain <select> for a GET filter form (no client JS needed). */
export function NativeSelectField({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string;
  label: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex min-w-48 flex-col gap-1.5">
      <span className="text-body-sm font-semibold text-text-primary">
        {label}
      </span>
      <span className="relative">
        <select
          name={name}
          defaultValue={defaultValue}
          className="h-11 w-full cursor-pointer appearance-none rounded-[var(--fg-radius-md)] border border-border-default bg-bg-surface pr-10 pl-3 text-body-md text-text-primary outline-none hover:bg-bg-sunken focus-visible:border-border-focus focus-visible:ring-2 focus-visible:ring-border-focus/30"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-text-tertiary"
        />
      </span>
    </label>
  );
}
