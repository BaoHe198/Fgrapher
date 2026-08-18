import Link from "next/link";

import { cn } from "@/lib/utils";

interface SectionHeadProps {
  title: string;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
}

function SectionHead({
  title,
  actionLabel,
  actionHref,
  className,
}: SectionHeadProps) {
  return (
    <div className={cn("mb-5 flex items-center justify-between", className)}>
      <h2 className="text-display-md text-text-primary">{title}</h2>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="text-body-md font-semibold text-text-link"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export { SectionHead };
