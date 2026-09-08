import Link from "next/link";

import { cn } from "@/lib/utils";

interface SectionHeadProps {
  title: string;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
  // Defaults to h2 — most call sites sit under a page that already has
  // its own <h1> elsewhere (e.g. the home page's hero). Several
  // standalone dashboard pages use SectionHead as their ONLY heading
  // though, and had no <h1> anywhere on the page at all as a result —
  // those pass as="h1" explicitly.
  as?: "h1" | "h2";
}

function SectionHead({
  title,
  actionLabel,
  actionHref,
  className,
  as: Heading = "h2",
}: SectionHeadProps) {
  return (
    <div className={cn("mb-5 flex items-center justify-between", className)}>
      <Heading className="text-display-md text-text-primary">{title}</Heading>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="text-body-md font-semibold! text-text-link"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export { SectionHead };
