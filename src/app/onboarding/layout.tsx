import type { ReactNode } from "react";

// The onboarding pages had no main landmark, so the root layout's "skip to
// main content" link pointed at nothing here.
export default function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <main id="main-content">{children}</main>;
}
