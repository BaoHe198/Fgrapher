import {
  Camera,
  CalendarCheck,
  Compass,
  Eye,
  MessageSquare,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { auth } from "@/lib/auth";
import { PROVIDER_ROLES, ROLE_LABELS } from "@/lib/constants";
import { db } from "@/lib/db";

const STATS: { label: string; value: number; icon: LucideIcon }[] = [
  { label: "Profile views", value: 0, icon: Eye },
  { label: "Upcoming bookings", value: 0, icon: CalendarCheck },
  { label: "New messages", value: 0, icon: MessageSquare },
  { label: "Followers", value: 0, icon: Users },
];

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { profiles: true },
  });
  if (!user) {
    redirect("/login");
  }

  const roles = session.user.roles;
  const nonCustomerRoles = roles.filter((role) => role !== "CUSTOMER");
  const hasProviderRole = roles.some((role) => PROVIDER_ROLES.includes(role));
  const hasIncompleteProfile =
    nonCustomerRoles.length > 0 &&
    !nonCustomerRoles.every((role) =>
      user.profiles.some((profile) => profile.role === role),
    );

  // Phase-0 heuristic — no profile editor exists yet to drive a real score.
  const completionFields = [
    user.avatar,
    user.bio,
    user.phone,
    user.location,
    user.username,
  ];
  const completion = Math.round(
    (completionFields.filter(Boolean).length / completionFields.length) * 100,
  );

  const firstName = user.firstName ?? user.name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Welcome back, {firstName}!
            </h1>
            <div className="flex flex-wrap gap-1.5">
              {roles.map((role) => (
                <Badge key={role} variant="secondary">
                  {ROLE_LABELS[role]}
                </Badge>
              ))}
            </div>
          </div>

          <div className="w-full space-y-1.5 sm:max-w-xs">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Profile completion</span>
              <span className="font-medium">{completion}%</span>
            </div>
            <Progress value={completion} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATS.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{label}</p>
                <Icon className="size-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        {hasIncompleteProfile ? (
          <Button nativeButton={false} render={<Link href="/profile" />}>
            <UserPlus />
            Complete your profile
          </Button>
        ) : null}
        {hasProviderRole ? (
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/profile" />}
          >
            <Camera />
            Upload portfolio
          </Button>
        ) : null}
        {roles.includes("CUSTOMER") ? (
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/search" />}
          >
            <Compass />
            Browse photographers
          </Button>
        ) : null}
      </div>
    </div>
  );
}
