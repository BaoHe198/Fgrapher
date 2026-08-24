import { ShieldAlert } from "lucide-react";

// Shown before a customer's first booking with a Model — see
// docs/guides/fgrapher-prompts-batch-2.md §3b item 4. Wired into the
// booking flow as part of §3c (booking-flow additions for Model bookings),
// since that's the same touch point — kept as a standalone component so
// it isn't duplicated between the desktop sidebar and mobile booking sheet.
export function ModelSafetyNotice() {
  return (
    <div className="flex gap-2.5 rounded-[var(--fg-radius-md)] bg-warning-bg p-3.5">
      <ShieldAlert className="size-5 shrink-0 text-warning" />
      <div className="flex flex-col gap-1">
        <span className="text-body-sm font-semibold text-text-primary">
          Before you book
        </span>
        <p className="text-body-sm text-text-secondary">
          Meet in public or at a registered studio for a first shoot, and let
          someone know where you&apos;ll be. Fgrapher never asks for payment
          outside the platform — report anything that feels off.
        </p>
      </div>
    </div>
  );
}
