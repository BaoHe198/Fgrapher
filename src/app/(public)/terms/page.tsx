import type { Metadata } from "next";

import { SimplePage } from "@/components/sections/simple-page";

export const metadata: Metadata = { title: "Terms of Service — Fgrapher" };

export default function TermsPage() {
  return (
    <SimplePage title="Terms of Service" subtitle="Last updated: early access / pre-launch draft">
      <p>
        Fgrapher is in early access. These terms are a placeholder for the pre-launch period —
        they will be replaced with a reviewed, complete version before public launch.
      </p>
      <h2>Using Fgrapher</h2>
      <p>
        By creating an account you agree to provide accurate information, use the platform
        lawfully, and treat other members professionally. Providers are responsible for the
        accuracy of their listings and the services they deliver.
      </p>
      <h2>Bookings and payments</h2>
      <p>
        Booking and payment terms will be published here once online payments launch. Until
        then, any arrangements made through profile contact details are between the client and
        provider directly.
      </p>
      <h2>Contact</h2>
      <p>Questions about these terms can be sent through the Contact page.</p>
    </SimplePage>
  );
}
