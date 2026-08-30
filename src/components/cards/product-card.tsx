import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { formatCurrency } from "@/lib/utils";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    type: "SALE" | "RENT" | "BOTH";
    price: number | null;
    rentalPrice: number | null;
    currency: string;
    condition: string;
    stock: number;
    images: { url: string }[];
    user: { name: string | null; firstName: string | null };
  };
}

export async function ProductCard({ product }: ProductCardProps) {
  const t = await getTranslations("uiKit.productCard");
  const tCondition = await getTranslations("uiKit.condition");
  const CONDITION_LABEL: Record<string, string> = {
    NEW: tCondition("new"),
    LIKE_NEW: tCondition("likeNew"),
    GOOD: tCondition("good"),
    FAIR: tCondition("fair"),
  };
  const shopName =
    product.user.firstName ?? product.user.name ?? t("shopFallback");
  const outOfStock = product.type !== "RENT" && product.stock === 0;

  return (
    <Link href={`/shop/${product.id}`}>
      <Card
        padding={false}
        className="cursor-pointer overflow-hidden transition-shadow duration-150 hover:shadow-[var(--shadow-md)]"
      >
        <div className="relative aspect-[4/3] w-full">
          {product.images[0] ? (
            <Image
              src={product.images[0].url}
              alt={product.name}
              fill
              className="object-cover"
            />
          ) : (
            <MediaPlaceholder
              tint="neutral-300"
              height="100%"
              className="absolute inset-0"
            />
          )}
          <span className="absolute top-2.5 left-2.5">
            <Badge variant={product.type === "RENT" ? "accent" : "neutral"}>
              {product.type === "RENT"
                ? t("rentalBadge")
                : product.type === "BOTH"
                  ? t("saleAndRentalBadge")
                  : t("forSaleBadge")}
            </Badge>
          </span>
          {outOfStock ? (
            <span className="absolute top-2.5 right-2.5">
              <Badge variant="destructive">{t("outOfStock")}</Badge>
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5 p-3.5">
          <span className="line-clamp-2 text-heading-sm text-text-primary">
            {product.name}
          </span>
          <Badge variant="neutral" className="w-fit">
            {CONDITION_LABEL[product.condition] ?? product.condition}
          </Badge>
          <span className="text-body-md font-semibold! text-text-primary">
            {product.type === "RENT" && product.rentalPrice
              ? `${formatCurrency(product.rentalPrice, product.currency)}${t("perDay")}`
              : product.price
                ? formatCurrency(product.price, product.currency)
                : product.rentalPrice
                  ? `${formatCurrency(product.rentalPrice, product.currency)}${t("perDay")}`
                  : "—"}
          </span>
          <span className="text-body-sm text-text-secondary">{shopName}</span>
        </div>
      </Card>
    </Link>
  );
}
