import type { Metadata } from "next";

import { SimplePage } from "@/components/sections/simple-page";

import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Liên hệ — Fgrapher" };

export default function ContactPage() {
  return (
    <SimplePage
      title="Liên hệ với chúng tôi"
      subtitle="Có câu hỏi hoặc phát hiện lỗi? Gửi tin nhắn cho chúng tôi."
    >
      <ContactForm />
    </SimplePage>
  );
}
