import type { Metadata } from "next";

import { SimplePage } from "@/components/sections/simple-page";

export const metadata: Metadata = { title: "Privacy Policy — Fgrapher" };

export default function PrivacyPage() {
  return (
    <SimplePage title="Privacy Policy" subtitle="Last updated: early access / pre-launch draft">
      <p>
        Fgrapher is in early access. This is a placeholder privacy policy for the pre-launch
        period — it will be replaced with a reviewed, complete version before public launch.
      </p>
      <h2>What we collect</h2>
      <p>
        Account details you provide (name, email, phone), profile content you upload (photos,
        videos, descriptions), and booking/messaging activity needed to operate the platform.
      </p>
      <h2>How we use it</h2>
      <p>
        To operate your account, connect clients and providers, process bookings, and improve
        the product. We don&apos;t sell your personal data.
      </p>
      <h2>Contact</h2>
      <p>Questions about this policy can be sent through the Contact page.</p>
    </SimplePage>
  );
}
