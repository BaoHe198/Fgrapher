import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { ProductCard } from "@/components/cards/product-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHead } from "@/components/ui/section-head";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/ui/star-rating";
import { auth } from "@/lib/auth";
import { features } from "@/lib/features";
import { jsonLdScriptProps } from "@/lib/utils";
import { getProductDetail } from "@/services/marketplace";
import {
  getProductRating,
  listProductReviews,
} from "@/services/product-reviews";

import { ProductGallery } from "./product-gallery";
import { ProductPurchasePanel } from "./product-purchase-panel";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ productId: string }>;
}): Promise<Metadata> {
  if (!features.marketplaceEnabled)
    return {
      title: `${(await getTranslations("publicPages.productDetail"))("notFound")} — Fgrapher`,
    };

  const { productId } = await params;
  const result = await getProductDetail(productId);
  if (!result)
    return {
      title: `${(await getTranslations("publicPages.productDetail"))("productNotFound")} — Fgrapher`,
    };
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
  const t = await getTranslations("publicPages.productDetail");
  if (!features.marketplaceEnabled) {
    notFound();
  }

  const { productId } = await params;
  // All three only need the id, which the route already gives us, so they go
  // out together. Run in sequence this page paid three round trips to
  // Singapore before rendering anything; the ratings and the reviews do not
  // depend on the product row.
  const [result, rating, reviews] = await Promise.all([
    getProductDetail(productId),
    getProductRating(productId),
    listProductReviews(productId),
  ]);
  if (!result) notFound();

  const { product, related, shopRating, shopReviewCount } = result;
  const session = await auth();
  const isOwner = session?.user?.id === product.user.id;
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
      <script {...jsonLdScriptProps(jsonLd)} />

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1.1fr_400px] lg:gap-12">
        <div className="flex flex-col gap-8">
          <ProductGallery images={product.images} name={product.name} />

          {product.description ? (
            <div className="flex flex-col gap-2">
              <h2 className="text-heading-lg text-text-primary">
                {t("description")}
              </h2>
              <p className="whitespace-pre-wrap text-body-md text-text-secondary">
                {product.description}
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            <h2 className="text-heading-lg text-text-primary">
              {t("reviewsTitle")}
            </h2>
            {reviews.length === 0 ? (
              <p className="text-body-md text-text-secondary">
                {t("noReviews")}
              </p>
            ) : (
              <>
                <StarRating
                  rating={rating.average.toFixed(1)}
                  reviews={rating.count}
                />
                <div className="flex flex-col gap-3">
                  {reviews.map((review) => (
                    <Card key={review.id} className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-body-md font-semibold! text-text-primary">
                          {review.reviewer.firstName ??
                            review.reviewer.name ??
                            ""}
                        </span>
                        <StarRating
                          rating={String(review.rating)}
                          reviews={0}
                        />
                      </div>
                      {review.content ? (
                        <p className="whitespace-pre-wrap text-body-md text-text-secondary">
                          {review.content}
                        </p>
                      ) : null}
                      {review.response ? (
                        <p className="text-body-sm text-text-tertiary">
                          {t("shopReply")} {review.response}
                        </p>
                      ) : null}
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>

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
                {/* A shop with no reviews rendered "★ Mới (0)": a star, a
                    word where the score goes and a zero count — three
                    signals disagreeing. Same rule as the profile header:
                    stars once there is something to average. */}
                {shopReviewCount > 0 ? (
                  <StarRating
                    rating={shopRating.toFixed(1)}
                    reviews={shopReviewCount}
                  />
                ) : (
                  <Badge variant="neutral" className="w-fit">
                    {t("newShopBadge")}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                nativeButton={false}
                render={<Link href={`/shop?sellerId=${product.user.id}`} />}
              >
                {t("viewShopProducts")}
              </Button>
              {isOwner ? null : (
                <Button
                  size="sm"
                  variant="secondary"
                  nativeButton={false}
                  render={
                    <Link href={`/dashboard/messages?to=${product.user.id}`} />
                  }
                >
                  {t("messageShop")}
                </Button>
              )}
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
            shopId={product.user.id}
            shopLocation={product.user.location}
            isOwner={isOwner}
          />
        </div>
      </div>

      {related.length > 0 ? (
        <div className="mt-12">
          <SectionHead title={t("moreFromShop")} />
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
