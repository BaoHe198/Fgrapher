"use client";

import { Loader2, MoreHorizontal, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { startTransition, useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { Tag } from "@/components/ui/tag";
import { formatCurrency } from "@/lib/utils";
import type { ListingFilter } from "@/services/products";

interface ProductRow {
  id: string;
  name: string;
  type: "SALE" | "RENT" | "BOTH";
  price: number | null;
  rentalPrice: number | null;
  currency: string;
  stock: number;
  images: { url: string }[];
}

const FILTERS: { value: ListingFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "SALE", label: "For sale" },
  { value: "RENT", label: "For rent" },
  { value: "OUT_OF_STOCK", label: "Out of stock" },
];

function typeBadge(type: ProductRow["type"]) {
  if (type === "RENT") return { label: "Rental", variant: "accent" as const };
  return { label: "For sale", variant: "neutral" as const };
}

function priceLabel(product: ProductRow) {
  if (product.type === "RENT") {
    return `${formatCurrency(product.rentalPrice ?? 0, product.currency)}/day`;
  }
  if (product.type === "BOTH") {
    return `${formatCurrency(product.price ?? 0, product.currency)} · ${formatCurrency(product.rentalPrice ?? 0, product.currency)}/day`;
  }
  return formatCurrency(product.price ?? 0, product.currency);
}

export function ListingsList() {
  const [filter, setFilter] = useState<ListingFilter>("ALL");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/products?type=${filter}`);
    const body = await res.json();
    setProducts(body.data ?? []);
    setIsLoading(false);
  }, [filter]);

  useEffect(() => {
    startTransition(() => {
      load();
    });
  }, [load]);

  const changeFilter = (value: ListingFilter) => {
    setIsLoading(true);
    setFilter(value);
  };

  const remove = async (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/products/${id}`, { method: "DELETE" });
  };

  const duplicate = async (id: string) => {
    await fetch(`/api/products/${id}/duplicate`, { method: "POST" });
    setIsLoading(true);
    load();
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Tag
            key={f.value}
            selected={filter === f.value}
            onClick={() => changeFilter(f.value)}
          >
            {f.label}
          </Tag>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-text-tertiary" />
        </div>
      ) : products.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <ShoppingBag className="size-12 text-text-tertiary" />
          <p className="text-body-lg font-semibold text-text-primary">
            No products listed
          </p>
          <p className="text-body-md text-text-secondary">
            Add your first camera, lens, or accessory.
          </p>
          <Button
            variant="secondary"
            size="sm"
            nativeButton={false}
            render={<Link href="/dashboard/listings/new" />}
          >
            Add product
          </Button>
        </Card>
      ) : (
        <Card padding={false}>
          {products.map((product) => {
            const badge = typeBadge(product.type);
            return (
              <div
                key={product.id}
                className="flex items-center gap-4 border-b border-border-subtle px-5 py-4 last:border-b-0"
              >
                <div className="size-16 shrink-0 overflow-hidden rounded-lg">
                  {product.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.images[0].url}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <MediaPlaceholder tint="neutral-300" height="100%" />
                  )}
                </div>

                <div className="flex-1">
                  <p className="text-heading-sm text-text-primary">
                    {product.name}
                  </p>
                  <p className="text-body-sm text-text-secondary">
                    {product.stock > 0
                      ? `${product.stock} in stock`
                      : "Out of stock"}
                  </p>
                </div>

                <Badge variant={badge.variant}>{badge.label}</Badge>
                <span className="text-body-md font-semibold text-text-primary">
                  {priceLabel(product)}
                </span>

                <Button
                  size="sm"
                  variant="ghost"
                  nativeButton={false}
                  render={
                    <Link href={`/dashboard/listings/${product.id}/edit`} />
                  }
                >
                  Edit
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button size="icon-sm" variant="ghost">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => duplicate(product.id)}>
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => remove(product.id)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
