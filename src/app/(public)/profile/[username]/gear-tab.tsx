import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { formatCurrency } from "@/lib/utils";

interface ProductItem {
  id: string;
  name: string;
  type: "SALE" | "RENT" | "BOTH";
  price: number | null;
  rentalPrice: number | null;
  currency: string;
  images: { url: string }[];
}

export function GearTab({ products }: { products: ProductItem[] }) {
  if (products.length === 0) {
    return (
      <p className="py-12 text-center text-body-md text-text-secondary">No gear listed yet</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {products.map((product) => (
          <Link
            key={product.id}
            href={`/shop/${product.id}`}
            className="overflow-hidden rounded-[var(--fg-radius-md)] bg-surface-card shadow-[var(--shadow-sm)]"
          >
            <div className="h-[120px] w-full">
              {product.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.images[0].url} alt="" className="size-full object-cover" />
              ) : (
                <MediaPlaceholder tint="neutral-300" height="100%" />
              )}
            </div>
            <div className="flex flex-col gap-1.5 p-3.5">
              <Badge variant={product.type === "RENT" ? "accent" : "neutral"}>
                {product.type === "RENT" ? "Rental" : "For sale"}
              </Badge>
              <span className="text-heading-sm text-text-primary">{product.name}</span>
              <span className="text-body-md font-semibold text-text-primary">
                {product.type === "RENT"
                  ? `${formatCurrency(product.rentalPrice ?? 0, product.currency)}/day`
                  : formatCurrency(product.price ?? 0, product.currency)}
              </span>
            </div>
          </Link>
        ))}
      </div>

      <Link href="/shop" className="self-center text-body-md font-semibold text-text-link">
        View all gear
      </Link>
    </div>
  );
}
