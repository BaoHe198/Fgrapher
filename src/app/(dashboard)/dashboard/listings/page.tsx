import { Shirt, ShoppingBag } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { SELLER_ROLES } from "@/lib/constants";
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

  const t = await getTranslations("dashboardCore.listings");

  if (!SELLER_ROLES.some((role) => session.user.roles.includes(role))) {
    // A costume shop is not a seller here on purpose — its outfits are a
    // profile catalogue rented through chat, not Chợ F products. Sending it
    // to "add a role that can sell" was the wrong advice and read as the
    // role having no way to post anything (QA-06); point it at its own
    // catalogue instead.
    const isCostumeShop = session.user.roles.includes("COSTUME_SHOP");
    return (
      <Card className="flex flex-col items-center gap-3 py-16 text-center">
        {isCostumeShop ? (
          <Shirt className="size-12 text-text-tertiary" />
        ) : (
          <ShoppingBag className="size-12 text-text-tertiary" />
        )}
        <p className="text-body-lg font-semibold! text-text-primary">
          {t(
            isCostumeShop
              ? "roleRequired.costumeShopTitle"
              : "roleRequired.title",
          )}
        </p>
        <p className="max-w-sm text-body-md text-text-secondary">
          {t(
            isCostumeShop
              ? "roleRequired.costumeShopBody"
              : "roleRequired.body",
          )}
        </p>
        <Button
          variant="secondary"
          size="sm"
          nativeButton={false}
          render={
            <Link
              href={
                isCostumeShop
                  ? "/dashboard/settings/profile?section=roleProfile#costumes"
                  : "/dashboard/settings/roles"
              }
            />
          }
        >
          {t(
            isCostumeShop ? "roleRequired.costumeShopCta" : "roleRequired.cta",
          )}
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHead
        title={t("pageTitle")}
        actionLabel={t("addProduct")}
        actionHref="/dashboard/listings/new"
      />
      <ListingsList />
    </div>
  );
}
