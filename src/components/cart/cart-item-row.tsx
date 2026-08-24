import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import type { CartItemWithProduct } from "@/hooks/use-cart";
import { formatDate } from "@/lib/format";
import { formatCurrency } from "@/lib/utils";

import { itemLineTotal, itemRentalDays } from "./cart-utils";

export function CartItemRow({
  item,
  onUpdateQuantity,
  onRemove,
}: {
  item: CartItemWithProduct;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
}) {
  const t = useTranslations("sharedComponents.cartItemRow");
  const days =
    item.type === "RENT" && item.rentalStart && item.rentalEnd
      ? itemRentalDays(item)
      : null;

  return (
    <div className="flex gap-3">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-[var(--fg-radius-sm)]">
        {item.product.images[0] ? (
          <Image
            src={item.product.images[0].url}
            alt={item.product.name}
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
      </div>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-body-md font-semibold text-text-primary">
          {item.product.name}
        </p>
        <Badge
          variant={item.type === "RENT" ? "accent" : "neutral"}
          className="mt-1"
        >
          {item.type === "RENT"
            ? t("rentalBadge", { days: days ?? 0 })
            : t("purchaseBadge")}
        </Badge>
        {item.type === "RENT" && item.rentalStart && item.rentalEnd ? (
          <p className="mt-1 text-body-sm text-text-secondary">
            {formatDate(item.rentalStart)} – {formatDate(item.rentalEnd)}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col items-end gap-2">
        <span className="text-body-md font-semibold text-text-primary">
          {formatCurrency(itemLineTotal(item), item.product.currency)}
        </span>
        {item.type === "SALE" ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))
              }
              className="flex size-6 items-center justify-center rounded-full border border-border-default text-body-sm"
            >
              −
            </button>
            <span className="w-4 text-center text-body-sm">
              {item.quantity}
            </span>
            <button
              type="button"
              onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
              className="flex size-6 items-center justify-center rounded-full border border-border-default text-body-sm"
            >
              +
            </button>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="text-text-tertiary hover:text-danger"
          aria-label={t("removeLabel")}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
