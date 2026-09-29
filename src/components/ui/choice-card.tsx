"use client";

import * as React from "react";
import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// One card for every "pick one / pick several" choice: service packages,
// location type, roles (system audit 09/2026 §05 - there were three
// hand-built versions). A real radio/checkbox sits inside a <label>, so the
// arrow keys move through a radio group and screen readers announce the
// state; the card only paints it. Focus is the shared gold ring, selection
// is always brand-primary (it brightens by itself in dark mode).

interface ChoiceCardProps {
  /** Group name - cards sharing it form one radio group. */
  name: string;
  value: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Small line under the description, e.g. "2 giờ · 30 ảnh". */
  meta?: React.ReactNode;
  /** Right-aligned price or "Báo giá sau". */
  price?: React.ReactNode;
  /** Leading icon tile (roles). */
  icon?: React.ReactNode;
  /** Extra content under the text (badges). */
  children?: React.ReactNode;
  selected: boolean;
  disabled?: boolean;
  invalid?: boolean;
  /** "single" renders a radio, "multiple" a checkbox. */
  mode?: "single" | "multiple";
  /** "sm" for narrow columns such as the profile's booking sidebar. */
  size?: "md" | "sm";
  onSelect: (value: string) => void;
  className?: string;
}

function ChoiceCard({
  name,
  value,
  title,
  description,
  meta,
  price,
  icon,
  children,
  selected,
  disabled = false,
  invalid = false,
  mode = "single",
  size = "md",
  onSelect,
  className,
}: ChoiceCardProps) {
  // Disabled AND selected means "always included" (CUSTOMER in the role
  // picker): it reads as chosen, not faded - only a card that is actually
  // locked out dims to .5.
  const locked = disabled && selected;
  return (
    <label
      data-slot="choice-card"
      data-selected={selected || undefined}
      data-interactive="true"
      className={cn(
        "group/choice relative flex items-start rounded-[var(--fg-radius-lg)] border bg-bg-surface text-left transition-[border-color,box-shadow,transform,background-color] duration-[var(--fg-dur-260)] ease-fg-out",
        size === "sm"
          ? "gap-3 rounded-[var(--fg-radius-md)] p-3"
          : "gap-3.5 p-4 sm:p-5",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-border-focus",
        selected
          ? "border-brand-primary shadow-[inset_0_0_0_1px_var(--brand-primary)]"
          : "border-border-subtle",
        !disabled &&
          "cursor-pointer hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] motion-reduce:hover:translate-y-0",
        !disabled && !selected && "hover:border-border-strong",
        invalid && !selected && "border-danger",
        disabled && !locked && "cursor-not-allowed opacity-50",
        locked && "cursor-default",
        className,
      )}
    >
      <input
        type={mode === "single" ? "radio" : "checkbox"}
        name={name}
        value={value}
        checked={selected}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={() => onSelect(value)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center border transition-colors duration-[var(--fg-dur-150)]",
          mode === "single" ? "rounded-full" : "rounded-[5px]",
          selected
            ? "border-brand-primary bg-brand-primary text-text-on-brand"
            : "border-border-strong bg-bg-surface",
        )}
      >
        {selected ? (
          mode === "single" ? (
            <span className="size-2 rounded-full bg-text-on-brand" />
          ) : (
            <CheckIcon className="size-3.5" strokeWidth={3} />
          )
        ) : null}
      </span>
      {icon ? (
        <span
          aria-hidden
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-[var(--fg-radius-md)] transition-colors duration-[var(--fg-dur-150)] [&_svg]:size-5",
            selected
              ? "bg-brand-primary text-text-on-brand"
              : "bg-bg-sunken text-brand-primary",
          )}
        >
          {icon}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-start justify-between gap-3">
          <span
            className={cn(
              "line-clamp-2 text-text-primary",
              size === "sm" ? "text-body-sm font-semibold!" : "text-heading-sm",
            )}
          >
            {title}
          </span>
          {price ? (
            <span
              className={cn(
                "shrink-0 font-mono font-semibold! tabular-nums text-text-primary",
                size === "sm" ? "text-body-sm" : "text-body-md",
              )}
            >
              {price}
            </span>
          ) : null}
        </span>
        {description ? (
          <span className="text-body-sm text-text-secondary">
            {description}
          </span>
        ) : null}
        {meta ? (
          <span className="text-meta text-text-tertiary">{meta}</span>
        ) : null}
        {children ? (
          <span className="mt-2 flex flex-wrap items-center gap-2">
            {children}
          </span>
        ) : null}
      </span>
    </label>
  );
}

interface ChoiceCardGroupProps {
  legend: React.ReactNode;
  /** Hide the legend visually when a heading already names the group. */
  hideLegend?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

function ChoiceCardGroup({
  legend,
  hideLegend = false,
  error,
  className,
  children,
}: ChoiceCardGroupProps) {
  const errorId = React.useId();
  return (
    <fieldset
      aria-describedby={error ? errorId : undefined}
      className="flex min-w-0 flex-col gap-3"
    >
      <legend
        className={cn(
          "mb-1 text-body-sm font-semibold! text-text-primary",
          hideLegend && "sr-only",
        )}
      >
        {legend}
      </legend>
      <div className={cn("grid gap-3", className)}>{children}</div>
      {error ? (
        <p id={errorId} className="text-body-sm text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export { ChoiceCard, ChoiceCardGroup };
