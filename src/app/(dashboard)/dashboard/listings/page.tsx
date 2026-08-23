import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHead } from "@/components/ui/section-head";
import { auth } from "@/lib/auth";
import { features } from "@/lib/features";

import { ListingsList } from "./listings-list";

export default async function ListingsPage() {
  if (!features.marketplaceEnabled) {
    notFound();
  }

  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (!session.user.roles.includes("CAMERA_SHOP")) {
    return (
      <Card className="flex flex-col items-center gap-3 py-16 text-center">
        <ShoppingBag className="size-12 text-text-tertiary" />
        <p className="text-body-lg font-semibold text-text-primary">
          Listings need the Camera Shop role
        </p>
        <p className="max-w-sm text-body-md text-text-secondary">
          Add the Camera Shop role to sell or rent out gear on Fgrapher.
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

  return (
    <div className="flex flex-col gap-5">
      <SectionHead
        title="Listings"
        actionLabel="Add product"
        actionHref="/dashboard/listings/new"
      />
      <ListingsList />
    </div>
  );
}
