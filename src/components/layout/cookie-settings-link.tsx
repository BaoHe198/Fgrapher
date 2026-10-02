"use client";

import { OPEN_COOKIE_SETTINGS_EVENT } from "@/lib/privacy/cookie-consent";

interface CookieSettingsLinkProps {
  label: string;
}

/** Footer entry that reopens the cookie banner to change the choice. */
export function CookieSettingsLink({ label }: CookieSettingsLinkProps) {
  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))
      }
      className="text-left text-body-sm text-text-secondary hover:text-text-primary max-md:flex max-md:min-h-11 max-md:items-center"
    >
      {label}
    </button>
  );
}
