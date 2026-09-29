// One look for every text-entry control (Input, NativeSelect, CurrencyInput,
// Textarea) - system audit 09/2026 §02/§05. The border is border-strong, not
// border-default: an input's edge is a UI component and needs 3:1 against
// the surface, which border-default (1.5:1) missed. Hover darkens one step;
// focus is the shared 2px gold ring 2px out; an error draws the border in
// danger.
export const fieldControlClass =
  "h-auto w-full min-w-0 rounded-[var(--fg-radius-md)] border border-border-strong bg-bg-surface px-3.5 py-2.5 text-body-md text-text-primary outline-none transition-[border-color,box-shadow,background-color] duration-[var(--fg-dur-150)] placeholder:text-text-tertiary hover:border-neutral-500 focus-visible:border-border-focus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger";
