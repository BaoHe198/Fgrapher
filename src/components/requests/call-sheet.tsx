import { useTranslations } from "next-intl";
import Image from "next/image";

import { buildMediaVariants } from "@/lib/media/variants";
import { cn } from "@/lib/utils";

export type CallSheetKey =
  "need" | "when" | "where" | "style" | "budget" | "note";

export interface CallSheetData {
  need?: string;
  /** Lines are split on "\n". */
  when?: string;
  where?: string;
  style?: string;
  refs?: { src: string; alt: string }[];
  budget?: string;
  note?: string;
}

interface CallSheetProps {
  code: string;
  /** The rubber stamp in the corner: "VÍ DỤ", "NHÁP", "CÒN 5 NGÀY"… */
  stamp: string;
  stampTone?: "neutral" | "accent" | "danger";
  data: CallSheetData;
  /** The row being asked right now, tinted. */
  active?: CallSheetKey;
  className?: string;
}

const ROWS: CallSheetKey[] = [
  "need",
  "when",
  "where",
  "style",
  "budget",
  "note",
];

// The call sheet (wave 2, Đặt lịch F): the one object the whole request
// flow is built around - the example on the public page, the draft that
// fills in while composing, the summary on the request page. A paper form,
// so it stays on the Paper surface in either theme. Empty rows say
// "Chưa điền" rather than disappearing, so the shape never changes.
export function CallSheet({
  code,
  stamp,
  stampTone = "neutral",
  data,
  active,
  className,
}: CallSheetProps) {
  const t = useTranslations("sharedComponents.callSheet");
  return (
    <div
      role="region"
      aria-label={t("label", { code })}
      className={cn(
        "flex flex-col rounded-[var(--fg-radius-md)] border border-border-default bg-surface-card text-text-primary",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-border-default px-5 pt-4 pb-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-meta tracking-[0.12em] text-text-tertiary uppercase">
            {t("heading")}
          </span>
          <strong className="font-mono text-body-lg tracking-[0.04em] whitespace-nowrap">
            {code}
          </strong>
        </div>
        <span
          className={cn(
            "shrink-0 -rotate-3 rounded-[var(--fg-radius-sm)] border-2 px-2 py-1 font-mono text-meta font-semibold tracking-[0.12em] uppercase",
            stampTone === "danger" && "border-danger text-danger",
            stampTone === "accent" &&
              "border-gold-500 text-gold-700 dark:text-gold-400",
            stampTone === "neutral" &&
              "border-border-strong text-text-secondary",
          )}
        >
          {stamp}
        </span>
      </div>
      <dl>
        {ROWS.map((key, index) => {
          const value = data[key];
          const refs = key === "style" ? (data.refs ?? []) : [];
          const empty = !value && refs.length === 0;
          return (
            <div
              key={key}
              data-row={key}
              className={cn(
                "grid grid-cols-[2rem_6.5rem_1fr] gap-x-3 border-b border-border-subtle px-5 py-3 transition-colors duration-[var(--fg-dur-260)] last:border-b-0 max-sm:grid-cols-[1.75rem_1fr] max-sm:gap-y-1",
                active === key && "bg-bg-sunken",
              )}
            >
              <span
                aria-hidden
                className="font-mono text-meta leading-6 text-text-tertiary"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <dt className="text-body-sm leading-6 font-semibold! text-text-secondary">
                {t(`rows.${key}`)}
              </dt>
              <dd className="flex min-w-0 flex-col gap-2 text-body-sm leading-6 max-sm:col-start-2">
                {value ? (
                  <span className="break-words whitespace-pre-line">
                    {value}
                  </span>
                ) : null}
                {empty ? (
                  <span className="text-text-tertiary italic">
                    {t("empty")}
                  </span>
                ) : null}
                {refs.length > 0 ? (
                  <span className="flex gap-2">
                    {refs.slice(0, 3).map((ref, i) => (
                      <span key={ref.src} className="flex w-16 flex-col gap-1">
                        <span className="relative grid aspect-square place-items-center bg-bg-sunken">
                          <Image
                            src={buildMediaVariants(ref.src).thumbnail}
                            alt={ref.alt}
                            fill
                            unoptimized
                            sizes="64px"
                            className="object-contain"
                          />
                        </span>
                        <span className="font-mono text-meta text-text-tertiary">
                          0{i + 1}A
                        </span>
                      </span>
                    ))}
                  </span>
                ) : null}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="border-t border-border-default px-5 py-3 text-body-sm text-text-tertiary">
        {t("footer")}
      </p>
    </div>
  );
}
