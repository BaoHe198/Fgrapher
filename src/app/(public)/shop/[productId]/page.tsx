import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductCard } from "@/components/cards/product-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHead } from "@/components/ui/section-head";
import { StarRating } from "@/components/ui/star-rating";
import { features } from "@/lib/features";
import { getProductDetail } from "@/services/marketplace";

import { ProductGallery } from "./product-gallery";
import { ProductPurchasePanel } from "./product-purchase-panel";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ productId: string }>;
}): Promise<Metadata> {
  if (!features.marketplaceEnabled) return { title: "Not found — Fgrapher" };

  const { productId } = await params;
  const result = await getProductDetail(productId);
  if (!result) return { title: "Product not found — Fgrapher" };
  return {
    title: `${result.product.name} — Fgrapher`,
    description: result.product.description ?? undefined,
    alternates: { canonical: `/shop/${productId}` },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  if (!features.marketplaceEnabled) {
    notFound();
  }

  const { productId } = await params;
  const result = await getProductDetail(productId);
  if (!result) notFound();

  const { product, related, shopRating, shopReviewCount } = result;
  const shopName =
    product.user.profiles[0]?.shopName ??
    product.user.firstName ??
    product.user.name ??
    "Shop";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    image: product.images.map((img) => img.url),
    offers: {
      "@type": "Offer",
      price: product.price ?? product.rentalPrice ?? undefined,
      priceCurrency: product.currency,
      availability:
        product.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1.1fr_400px] lg:gap-12">
        <div className="flex flex-col gap-8">
          <ProductGallery images={product.images} name={product.name} />

          {product.description ? (
            <div className="flex flex-col gap-2">
              <h2 className="text-heading-lg text-text-primary">Description</h2>
              <p className="whitespace-pre-wrap text-body-md text-text-secondary">
                {product.description}
              </p>
            </div>
          ) : null}

          <Card className="flex flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar className="size-11">
                {product.user.avatar ? (
                  <AvatarImage src={product.user.avatar} alt="" />
                ) : null}
                <AvatarFallback>{shopName[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-body-md font-semibold! text-text-primary">
                  {shopName}
                </span>
                <StarRating
                  rating={shopRating > 0 ? shopRating.toFixed(1) : "New"}
                  reviews={shopReviewCount}
                />
              </div>
            </div>
            <div className="flex gap-2">
              {product.user.username ? (
                <Button
                  size="sm"
                  variant="secondary"
                  nativeButton={false}
                  render={<Link href={`/profile/${product.user.username}`} />}
                >
                  View shop
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="secondary"
                nativeButton={false}
                render={
                  <Link href={`/dashboard/messages?to=${product.user.id}`} />
                }
              >
                Message
              </Button>
            </div>
          </Card>
        </div>

        <div className="sticky top-[104px]">
          <ProductPurchasePanel
            product={{
              id: product.id,
              name: product.name,
              type: product.type,
              price: product.price,
              rentalPrice: product.rentalPrice,
              depositAmount: product.depositAmount,
              currency: product.currency,
              condition: product.condition,
              stock: product.stock,
            }}
            shopLocation={product.user.location}
          />
        </div>
      </div>

      {related.length > 0 ? (
        <div className="mt-12">
          <SectionHead title="More from this shop" />
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {related.map((p) => (
              <ProductCard
                key={p.id}
                product={{
                  ...p,
                  user: {
                    name: product.user.name,
                    firstName: product.user.firstName,
                  },
                }}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
