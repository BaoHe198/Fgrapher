"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Renders the `<terms>…</terms>` tag inside a consent string as a link to the
 * terms page. Shared so every "I agree to …" checkbox in the app points at the
 * same place and looks the same — the booking wizard and the shop checkout
 * both had this text with nothing to click, so there was no way to read what
 * you were agreeing to without leaving the flow and hunting the footer.
 *
 * Use with next-intl's `t.rich`:
 *
 *   <Checkbox label={t.rich("agreeTerms", { terms: termsChunk })} … />
 *
 * Opens in a new tab: these checkboxes sit at the end of a multi-step flow, so
 * navigating away in place would mean coming back and finding your place again.
 */
export function termsChunk(chunks: ReactNode) {
  return (
    <Link
      href="/terms"
      target="_blank"
      rel="noopener noreferrer"
      // Checkbox renders its label inside a <label htmlFor>, so a click
      // anywhere in that text — this link included — also toggles the box.
      // Without this, opening the terms would silently flip the very consent
      // the link belongs to.
      onClick={(event) => event.stopPropagation()}
      className="text-text-primary underline underline-offset-2 hover:no-underline"
    >
      {chunks}
    </Link>
  );
}
