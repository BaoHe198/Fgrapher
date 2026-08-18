import type { Metadata } from "next";

import { SimplePage } from "@/components/sections/simple-page";

export const metadata: Metadata = { title: "Help Center — Fgrapher" };

const FAQS = [
  {
    q: "How do I become a provider?",
    a: "Sign up as a Creative pro and pick the roles that fit you — Photographer, Videographer, Make-up Artist, Studio, or Camera Shop. You can add or change roles anytime from Settings.",
  },
  {
    q: "How do bookings work?",
    a: "Clients pick a service and an open time slot on a provider's profile and request a booking. Providers can accept or decline requests from their dashboard.",
  },
  {
    q: "Is Fgrapher free to use?",
    a: "Browsing and booking is free for clients. Customer access is always free; paid roles unlock provider features like portfolios and listings.",
  },
  {
    q: "How do I contact support?",
    a: "Use the Contact page and we'll get back to you as soon as we can.",
  },
];

export default function HelpPage() {
  return (
    <SimplePage title="Help Center" subtitle="Answers to common questions.">
      <div className="flex flex-col gap-6">
        {FAQS.map((item) => (
          <div key={item.q} className="flex flex-col gap-1.5">
            <h2 className="text-heading-md text-text-primary">{item.q}</h2>
            <p>{item.a}</p>
          </div>
        ))}
      </div>
    </SimplePage>
  );
}
