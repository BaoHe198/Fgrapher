import { Camera } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHead } from "@/components/ui/section-head";
import { Tag } from "@/components/ui/tag";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PAID_ROLES, ROLE_LABELS } from "@/lib/constants";

import { PortfolioGrid } from "./portfolio-grid";

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const canUpload = session.user.roles.some((role) => role !== "CUSTOMER");
  if (!canUpload) {
    return (
      <Card className="flex flex-col items-center gap-3 py-16 text-center">
        <Camera className="size-12 text-text-tertiary" />
        <p className="text-body-lg font-semibold text-text-primary">
          Portfolio is for creative pros
        </p>
        <p className="max-w-sm text-body-md text-text-secondary">
          Add a paid role — Photographer, Videographer, Make-up Artist, Studio, or Camera
          Shop — to showcase your work.
        </p>
        <Button
          variant="secondary"
          size="sm"
          nativeButton={false}
          render={<Link href="/dashboard/settings/roles" />}
        >
          Add a role
        </Button>
      </Card>
    );
  }

  const profiles = await db.profile.findMany({
    where: { userId: session.user.id, role: { in: PAID_ROLES } },
    orderBy: { createdAt: "asc" },
  });

  if (profiles.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 py-16 text-center">
        <Camera className="size-12 text-text-tertiary" />
        <p className="text-body-lg font-semibold text-text-primary">Set up your profile first</p>
        <p className="max-w-sm text-body-md text-text-secondary">
          Create your provider profile before uploading portfolio media.
        </p>
        <Button
          variant="secondary"
          size="sm"
          nativeButton={false}
          render={<Link href="/dashboard/settings/profile" />}
        >
          Set up profile
        </Button>
      </Card>
    );
  }

  const { profile: profileParam } = await searchParams;
  const activeProfile = profiles.find((p) => p.role === profileParam) ?? profiles[0];

  const media = await db.profileMedia.findMany({
    where: { profileId: activeProfile.id },
    orderBy: { order: "asc" },
  });

  return (
    <div className="flex flex-col gap-5">
      <SectionHead title="Portfolio" />

      {profiles.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {profiles.map((p) => (
            <Tag
              key={p.id}
              selected={p.id === activeProfile.id}
              render={<Link href={`/dashboard/portfolio?profile=${p.role}`} />}
            >
              {ROLE_LABELS[p.role]}
            </Tag>
          ))}
        </div>
      ) : null}

      <PortfolioGrid
        key={activeProfile.id}
        profileId={activeProfile.id}
        initialMedia={media.map((m) => ({ id: m.id, url: m.url, type: m.type, title: m.title }))}
      />
    </div>
  );
}
