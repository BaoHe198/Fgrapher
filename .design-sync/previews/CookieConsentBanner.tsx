import { useEffect, type ReactNode } from "react";
import { CookieConsentBanner } from "fgrapher";

// The banner is position: fixed and not portalled; the card's transformed
// root becomes its containing block, so give that root the page's height.
function Page({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-72px)] rounded-[var(--fg-radius-lg)] bg-bg-sunken">
      {children}
    </div>
  );
}

export const FirstVisit = () => (
  <Page>
    <CookieConsentBanner initialAnalytics={null} />
  </Page>
);

// With a stored choice the banner stays closed until the footer's
// "Cài đặt cookie" link reopens it through this window event.
function Reopen() {
  useEffect(() => {
    window.dispatchEvent(new Event("fg:open-cookie-settings"));
  }, []);
  return null;
}

export const ReopenedAnalyticsAllowed = () => (
  <Page>
    <CookieConsentBanner initialAnalytics={true} />
    <Reopen />
  </Page>
);

export const ReopenedNecessaryOnly = () => (
  <Page>
    <CookieConsentBanner initialAnalytics={false} />
    <Reopen />
  </Page>
);
