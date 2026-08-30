import { ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";

// Shown before a customer's first booking with a Model — see
// docs/guides/fgrapher-prompts-batch-2.md §3b item 4. Wired into the
// booking flow as part of §3c (booking-flow additions for Model bookings),
// since that's the same touch point — kept as a standalone component so
// it isn't duplicated between the desktop sidebar and mobile booking sheet.
export async function ModelSafetyNotice() {
  const t = await getTranslations("sharedComponents.modelSafetyNotice");

  return (
    <div className="flex gap-2.5 rounded-[var(--fg-radius-md)] bg-warning-bg p-3.5">
      <ShieldAlert className="size-5 shrink-0 text-warning" />
      <div className="flex flex-col gap-1">
        <span className="text-body-sm font-semibold! text-text-primary">
          {t("title")}
        </span>
        <p className="text-body-sm text-text-secondary">{t("body")}</p>
      </div>
    </div>
  );
}
