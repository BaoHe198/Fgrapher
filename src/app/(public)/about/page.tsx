import type { Metadata } from "next";

import { SimplePage } from "@/components/sections/simple-page";

export const metadata: Metadata = { title: "About — Fgrapher" };

export default function AboutPage() {
  return (
    <SimplePage
      title="About Fgrapher"
      subtitle="The platform where photographers, videographers, make-up artists, studios, and camera shops get discovered."
    >
      <p>
        Fgrapher connects clients with the creative professionals behind their favorite shoots
        — and connects those professionals with the clients who are searching for them. Build a
        portfolio, list your services, manage bookings, and get found, all in one place.
      </p>
      <p>
        We&apos;re currently in early access. If you run into something that isn&apos;t working
        the way you&apos;d expect, we&apos;d love to hear about it — see the Contact page.
      </p>
    </SimplePage>
  );
}
