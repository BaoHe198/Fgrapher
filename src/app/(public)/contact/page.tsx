import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SimplePage } from "@/components/sections/simple-page";

import { ContactForm } from "./contact-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("publicPages.contact");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/contact" },
  };
}

export default async function ContactPage() {
  const t = await getTranslations("publicPages.contact");
  return (
    <SimplePage title={t("title")} subtitle={t("subtitle")}>
      <ContactForm />
    </SimplePage>
  );
}
