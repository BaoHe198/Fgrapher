"use client";

import { OPEN_COOKIE_SETTINGS_EVENT } from "@/lib/cookie-consent";

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
      className="text-left text-body-sm text-text-secondary hover:text-text-primary"
    >
      {label}
    </button>
  );
}
