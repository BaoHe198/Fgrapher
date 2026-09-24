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
    // h-full on both, so every card in a grid row is the same height no
    // matter how long its name is; the price and shop name then line up
    // across the row via mt-auto below.
    <Link href={`/shop/${product.id}`} className="h-full">
      <Card padding={false} interactive className="flex h-full flex-col">
        <div className="relative aspect-[4/3] w-full shrink-0">
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

        <div className="flex flex-1 flex-col gap-1.5 p-3.5">
          <span className="line-clamp-2 text-heading-sm text-text-primary">
            {product.name}
          </span>
          <Badge variant="neutral" className="w-fit">
            {CONDITION_LABEL[product.condition] ?? product.condition}
          </Badge>
          <span className="mt-auto text-body-md font-semibold! text-text-primary">
            {product.type === "RENT" && product.rentalPrice
              ? `${formatCurrency(product.rentalPrice, product.currency)}${t("perDay")}`
              : product.price
                ? formatCurrency(product.price, product.currency)
                : product.rentalPrice
                  ? `${formatCurrency(product.rentalPrice, product.currency)}${t("perDay")}`
                  : "—"}
          </span>
          {/* "Sale & rental" showed only the sale price, so someone who
              only wanted to rent had to open the listing to learn whether
              it was affordable. */}
          {/* Always rendered, blank when there's nothing to say, so the
              extra line on one card doesn't lift its price out of line
              with the rest of the row. */}
          {product.type === "BOTH" && product.price && product.rentalPrice ? (
            <span className="text-body-sm text-text-secondary">
              {t("orRent", {
                price: formatCurrency(product.rentalPrice, product.currency),
              })}
            </span>
          ) : (
            <span aria-hidden className="text-body-sm">
              {"\u00a0"}
            </span>
          )}
          <span className="text-body-sm text-text-secondary">{shopName}</span>
        </div>
      </Card>
    </Link>
  );
}
