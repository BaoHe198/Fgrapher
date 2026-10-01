import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";

import { GearIcon } from "@/components/shop/gear-icon";
import { normalizeProductCategory } from "@/lib/validations/product";
import { cn, formatCurrency } from "@/lib/utils";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    category: string;
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

// Chợ F's card as a spec sheet (wave 2): the equipment on a plain ground,
// never cropped; a mono line for category and condition; prices in mono.
// No photo yet shows a dashed frame with the icon of what is missing, and
// out of stock is a dashed label rather than a red badge.
export async function ProductCard({ product }: ProductCardProps) {
  const t = await getTranslations("uiKit.productCard");
  const tCondition = await getTranslations("uiKit.condition");
  const tCategory = await getTranslations("productCategory");
  const CONDITION_LABEL: Record<string, string> = {
    NEW: tCondition("new"),
    LIKE_NEW: tCondition("likeNew"),
    GOOD: tCondition("good"),
    FAIR: tCondition("fair"),
  };
  const shopName =
    product.user.firstName ?? product.user.name ?? t("shopFallback");
  const outOfStock = product.type !== "RENT" && product.stock === 0;
  const category = normalizeProductCategory(product.category);
  const typeLabel =
    product.type === "RENT"
      ? t("rentalBadge")
      : product.type === "BOTH"
        ? t("saleAndRentalBadge")
        : t("forSaleBadge");

  return (
    <Link
      href={`/shop/${product.id}`}
      className="group focus-ring flex h-full flex-col gap-2.5 rounded-[var(--fg-radius-md)]"
    >
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-[var(--fg-radius-md)] bg-bg-sunken">
        {product.images[0] ? (
          <Image
            src={product.images[0].url}
            alt={product.name}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-contain p-4 transition-transform duration-[var(--fg-dur-400)] ease-fg-out group-hover:scale-[1.03] motion-reduce:transition-none"
          />
        ) : (
          <span className="absolute inset-3 flex flex-col items-center justify-center gap-2 rounded-[var(--fg-radius-sm)] border border-dashed border-border-strong text-text-tertiary">
            <GearIcon category={product.category} className="size-10" />
            <span className="font-mono text-meta tracking-[0.12em] uppercase">
              {t("noPhoto")}
            </span>
          </span>
        )}
        <span className="absolute top-2.5 left-2.5 rounded-[4px] bg-bg-surface px-1.5 py-1 font-mono text-meta tracking-[0.12em] text-text-primary uppercase">
          {typeLabel}
        </span>
        {outOfStock ? (
          <span className="absolute top-2.5 right-2.5 rounded-[4px] border border-dashed border-text-secondary bg-bg-surface px-1.5 py-1 font-mono text-meta tracking-[0.12em] text-text-secondary uppercase">
            {t("outOfStock")}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <span className="font-mono text-meta tracking-[0.12em] text-text-tertiary uppercase">
          {[
            category ? tCategory(category) : null,
            CONDITION_LABEL[product.condition] ?? product.condition,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <span className="line-clamp-2 text-heading-sm text-text-primary group-hover:underline group-hover:underline-offset-4">
          {product.name}
        </span>
        <span className="mt-auto flex flex-col gap-0.5 pt-1.5 font-mono text-body-md tabular-nums text-text-primary">
          {product.type !== "RENT" && product.price ? (
            <span className="font-semibold">
              {formatCurrency(product.price, product.currency)}
            </span>
          ) : null}
          {product.type !== "SALE" && product.rentalPrice ? (
            <span
              className={cn(
                product.type === "BOTH"
                  ? "text-body-sm text-text-secondary"
                  : "font-semibold",
              )}
            >
              {formatCurrency(product.rentalPrice, product.currency)}
              {t("perDay")}
            </span>
          ) : null}
        </span>
        <span className="text-body-sm text-text-secondary">{shopName}</span>
      </div>
    </Link>
  );
}
