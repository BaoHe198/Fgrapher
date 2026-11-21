import { Footer } from "@/components/layout/footer";
import { WebNav } from "@/components/layout/web-nav";
import { ShutterTransition } from "@/components/ui/shutter-transition";
import { features } from "@/lib/features";
import { hasPublicPlaces } from "@/services/places";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <WebNav
        marketplaceEnabled={features.marketplaceEnabled}
        socialFeedEnabled={features.socialFeedEnabled}
        placesEnabled={await hasPublicPlaces()}
      />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer />
      <ShutterTransition />
    </div>
  );
}
