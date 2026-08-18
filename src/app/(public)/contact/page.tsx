import type { Metadata } from "next";

import { SimplePage } from "@/components/sections/simple-page";

import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Contact — Fgrapher" };

export default function ContactPage() {
  return (
    <SimplePage title="Contact us" subtitle="Have a question or found a bug? Send us a message.">
      <ContactForm />
    </SimplePage>
  );
}
