// Design-sync shim for next/link: Claude Design renders components outside
// Next.js, where the App Router's <Link> has no router to attach to. A plain
// anchor keeps the markup, classes and href the real component renders.
import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from "react";

type Href = string | { pathname?: string; query?: Record<string, string> };

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: Href;
  children?: ReactNode;
  prefetch?: boolean | null;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
}

function toHref(href: Href): string {
  if (typeof href === "string") return href;
  const qs = href.query ? `?${new URLSearchParams(href.query)}` : "";
  return `${href.pathname ?? ""}${qs}`;
}

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, prefetch: _p, replace: _r, scroll: _s, shallow: _sh, ...rest },
  ref,
) {
  return <a ref={ref} href={toHref(href)} {...rest} />;
});

export default Link;
