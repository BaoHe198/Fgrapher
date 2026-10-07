import type { Role } from "@prisma/client";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { EditorialHero } from "@/components/ui/editorial-hero";
import { getAboutFrames, HOME_ROLES } from "@/services/home";

import { ContactForm } from "../contact/contact-form";
import { AboutStory, type StoryChapter } from "./about-story";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("publicPages.about");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/about" },
  };
}

// Frame of the contact sheet each story chapter shows: 01A photographer,
// 01C make-up, 02D studio, 02F costume rental (wave 2 About design).
const CHAPTER_FRAMES = [0, 2, 9, 11] as const;

// Every claim on this page is checked against what the product does. The
// design draft's "eKYC trong nước" and "dữ liệu không rời Việt Nam" were
// not true (an admin reviews ID photos by hand, stored on Cloudinary), so
// that copy was rewritten. The subject-consent line is true: uploading
// requires the rights checkbox (ProfileMedia.rightsConfirmedAt). Change
// the copy together with the behaviour.
export default async function AboutPage() {
  const t = await getTranslations("publicPages.about");
  const tRole = await getTranslations("role");
  const frames = await getAboutFrames();

  // HOME_ROLES are exactly the six roles with a short label.
  const roleShort = (role: Role) =>
    t(`roleShort.${role as (typeof HOME_ROLES)[number]}` as "roleShort.STUDIO");

  const sheetFrames = frames.map((frame, index) => ({
    src: frame.url,
    width: frame.width,
    height: frame.height,
    label: String(index + 1),
    meta: roleShort(frame.role),
    alt: t("hero.frameAlt", { role: tRole(frame.role) }),
  }));

  const chapters: StoryChapter[] = CHAPTER_FRAMES.map((frame, i) => ({
    frame,
    eyebrow: t("story.chapter", {
      n: i + 1,
      role: roleShort(HOME_ROLES[frame % 6]),
    }),
    problem: t(`story.c${i + 1}p`),
    answer: t(`story.c${i + 1}a`),
  }));

  const customerSteps = [1, 2, 3].map((n) => ({
    label: String(n),
    title: t(`paths.s${n}t`),
    body: t(`paths.s${n}b`),
  }));
  const artistSteps = [4, 5, 6].map((n) => ({
    label: String(n - 3),
    title: t(`paths.s${n}t`),
    body: t(`paths.s${n}b`),
  }));

  return (
    <>
      <EditorialHero
        section={t("hero.section")}
        title={t("hero.title")}
        lede={t("hero.lede")}
        actions={
          <>
            <Button
              variant="accent"
              nativeButton={false}
              render={<Link href="/browse" />}
            >
              {t("hero.findArtist")}
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="#hai-loi-di" />}
            >
              {t("hero.iAmArtist")}
            </Button>
          </>
        }
        media={{
          type: "contact",
          frames: sheetFrames.map(({ src, label, alt, meta }) => ({
            src,
            label,
            alt,
            meta,
          })),
        }}
      />

      <section
        aria-labelledby="about-story"
        className="bg-bg-page text-text-primary"
      >
        <div className="mx-auto flex max-w-[1440px] flex-col gap-[clamp(24px,4vw,48px)] px-[clamp(20px,4vw,64px)] pt-[clamp(56px,7vw,112px)] pb-[clamp(40px,5vw,80px)]">
          <div className="flex max-w-[820px] flex-col gap-3.5">
            <span className="font-mono text-meta tracking-[0.12em] text-text-tertiary uppercase">
              {t("story.eyebrow")}
            </span>
            <h2
              id="about-story"
              className="font-display text-[clamp(2rem,calc(1rem+2.6vw),3.5rem)] leading-[1.02] font-semibold tracking-[-0.025em] text-balance"
            >
              {t("story.title")}
            </h2>
          </div>
          <AboutStory frames={sheetFrames} chapters={chapters} />
        </div>
      </section>

      <div className="bg-bg-page">
        <section
          id="hai-loi-di"
          aria-labelledby="about-paths"
          className="mx-auto flex max-w-7xl scroll-mt-24 flex-col gap-8 px-5 py-[clamp(56px,7vw,96px)] sm:px-8"
        >
          <SectionTitle id="about-paths" eyebrow={t("paths.eyebrow")}>
            {t("paths.title")}
          </SectionTitle>
          <div className="grid gap-5 lg:grid-cols-2">
            <PathCard
              tag={t("paths.customerTag")}
              title={t("paths.customerTitle")}
              steps={customerSteps}
            >
              <Button
                variant="accent"
                nativeButton={false}
                render={<Link href="/browse" />}
              >
                {t("paths.findArtist")}
              </Button>
              <Button
                variant="ghost"
                nativeButton={false}
                render={<Link href="/fmap" />}
              >
                {t("paths.openMap")}
              </Button>
            </PathCard>
            <PathCard
              tag={t("paths.artistTag")}
              title={t("paths.artistTitle")}
              steps={artistSteps}
            >
              <div className="flex w-full flex-col gap-4">
                <ul
                  aria-label={t("paths.rolesLabel")}
                  className="flex flex-wrap gap-2"
                >
                  {HOME_ROLES.map((role) => (
                    <li key={role}>
                      <Link
                        href={`/login?mode=register&role=${role}`}
                        className="focus-ring inline-flex rounded-full border border-border-default px-3 py-1 text-body-sm text-text-secondary transition-colors duration-[var(--fg-dur-150)] hover:border-border-strong hover:text-text-primary"
                      >
                        {tRole(role)}
                      </Link>
                    </li>
                  ))}
                </ul>
                <div>
                  <Button
                    variant="primary"
                    nativeButton={false}
                    render={<Link href="/login?mode=register" />}
                  >
                    {t("paths.register")}
                  </Button>
                </div>
              </div>
            </PathCard>
          </div>
        </section>

        <section
          aria-labelledby="about-trust"
          className="mx-auto flex max-w-7xl flex-col gap-8 px-5 pb-[clamp(56px,7vw,96px)] sm:px-8"
        >
          <SectionTitle id="about-trust" eyebrow={t("trust.eyebrow")}>
            {t("trust.title")}
          </SectionTitle>
          <ol className="grid gap-x-12 gap-y-8 md:grid-cols-2">
            {[1, 2, 3, 4].map((n) => (
              <li key={n} className="grid grid-cols-[3rem_1fr] gap-x-4 gap-y-2">
                <span className="pt-1 font-mono text-meta tracking-[0.12em] text-text-tertiary">
                  {n}
                </span>
                <div className="flex flex-col gap-2">
                  <h3 className="text-heading-sm text-text-primary">
                    {t(`trust.t${n}`)}
                  </h3>
                  <p className="text-body-md text-text-secondary">
                    {t(`trust.b${n}`)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <p className="text-body-sm text-text-secondary">
            {t("trust.reportLead")}{" "}
            <Link
              href="/contact"
              className="focus-ring rounded-[4px] font-semibold! text-text-link underline-offset-4 hover:underline"
            >
              {t("trust.report")}
            </Link>
          </p>
        </section>

        <section
          aria-labelledby="about-stats"
          className="mx-auto max-w-7xl px-5 pb-[clamp(56px,7vw,96px)] sm:px-8"
        >
          <div className="flex flex-col gap-5 rounded-[var(--fg-radius-lg)] bg-bg-sunken p-[clamp(24px,4vw,48px)] md:flex-row md:items-end md:justify-between">
            <div className="flex max-w-2xl flex-col gap-3">
              <span className="font-mono text-meta tracking-[0.12em] text-text-tertiary uppercase">
                {t("stats.eyebrow")}
              </span>
              <h2
                id="about-stats"
                className="text-heading-lg text-text-primary"
              >
                {t("stats.title")}
              </h2>
              <p className="text-body-md text-text-secondary">
                {t("stats.body")}
              </p>
            </div>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/login?mode=register" />}
            >
              {t("stats.cta")}
            </Button>
          </div>
        </section>

        <section
          aria-labelledby="about-faq"
          className="mx-auto grid max-w-7xl gap-10 px-5 pb-[clamp(56px,7vw,112px)] sm:px-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]"
        >
          <div className="flex flex-col gap-6">
            <SectionTitle id="about-faq" eyebrow={t("faq.eyebrow")}>
              {t("faq.title")}
            </SectionTitle>
            <Accordion>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <AccordionItem key={n} value={`q${n}`}>
                  <AccordionTrigger>{t(`faq.q${n}`)}</AccordionTrigger>
                  <AccordionPanel>
                    <p className="pb-4">{t(`faq.a${n}`)}</p>
                  </AccordionPanel>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
          <div className="flex flex-col gap-4 self-start rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-surface p-6">
            <span className="text-caption-upper text-text-tertiary">
              {t("faq.contactEyebrow")}
            </span>
            <h3 className="text-heading-md text-text-primary">
              {t("faq.contactTitle")}
            </h3>
            <p className="text-body-sm text-text-secondary">
              {t("faq.contactBody")}
            </p>
            <ContactForm />
          </div>
        </section>
      </div>
    </>
  );
}

function SectionTitle({
  id,
  eyebrow,
  children,
}: {
  id: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="font-mono text-meta tracking-[0.12em] text-text-tertiary uppercase">
        {eyebrow}
      </span>
      <h2
        id={id}
        className="font-display text-[clamp(2rem,calc(1rem+2.2vw),3rem)] leading-[1.05] font-semibold tracking-[-0.025em] text-balance text-text-primary"
      >
        {children}
      </h2>
    </div>
  );
}

function PathCard({
  tag,
  title,
  steps,
  children,
}: {
  tag: string;
  title: string;
  steps: { label: string; title: string; body: string }[];
  children: React.ReactNode;
}) {
  return (
    <article className="flex flex-col gap-6 rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-surface p-[clamp(20px,3vw,32px)]">
      <div className="flex flex-col gap-2">
        <span className="text-caption-upper text-text-tertiary">{tag}</span>
        <h3 className="text-heading-md text-text-primary">{title}</h3>
      </div>
      <ol className="flex flex-col gap-5">
        {steps.map((step) => (
          <li key={step.label} className="grid grid-cols-[3rem_1fr] gap-x-3">
            <span className="pt-0.5 font-mono text-meta tracking-[0.12em] text-gold-600 dark:text-gold-400">
              {step.label}
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-body-md font-semibold! text-text-primary">
                {step.title}
              </span>
              <span className="text-body-sm text-text-secondary">
                {step.body}
              </span>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-auto flex flex-wrap items-center gap-3">
        {children}
      </div>
    </article>
  );
}
