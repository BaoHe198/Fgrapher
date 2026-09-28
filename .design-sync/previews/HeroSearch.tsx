import { HeroContactSheet, HeroSearch } from "fgrapher";

const photo = (from: string, to: string, label: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='600' height='600' fill='url(#g)'/><text x='36' y='560' font-family='sans-serif' font-size='34' fill='rgba(255,255,255,0.75)'>${label}</text></svg>`,
  )}`;

const heroPhotos = [
  { url: photo("#0f3d33", "#c9a24d", "Nhiếp ảnh gia"), alt: "Nhiếp ảnh gia tác nghiệp lúc hoàng hôn" },
  { url: photo("#3b2a1a", "#e8d3a8", "Trang điểm"), alt: "Chuyên viên trang điểm đang trang điểm cho khách" },
  { url: photo("#1c2b36", "#8fb3c7", "Quay phim"), alt: "Quay phim đang ghi hình bằng máy quay chuyên nghiệp" },
  { url: photo("#2a2320", "#b88a5a", "Studio"), alt: "Không gian studio với đèn chụp ảnh chuyên nghiệp" },
];

// The landing hero exactly as src/app/(public)/page.tsx composes it: the
// white search pill sits on the dark-green section, under the headline.
// Below the lg breakpoint the contact sheet hides and the search collapses
// to the role quick-pick + search + filter buttons.
export const LandingHero = () => (
  <section data-hero-still className="relative bg-green-900 text-gold-50">
    {/* The contact-sheet frames fade in over 900ms; a static capture lands
        mid-fade. Pin them settled (preview-only). */}
    <style>{"[data-hero-still] img{animation:none!important}"}</style>
    <div className="mx-auto flex max-w-[1440px] flex-col gap-7 px-8 py-10 max-md:px-5">
      <div className="grid grid-cols-[1.4fr_1fr] items-center gap-10 max-lg:contents">
        <div className="flex flex-col gap-[22px] max-lg:contents">
          <h1 className="m-0 text-display-lg tracking-[-0.02em] lg:text-display-xl">
            Tìm nghệ sĩ giúp bạn lưu giữ những kỷ niệm đẹp nhất
          </h1>
        </div>
        <HeroContactSheet photos={heroPhotos} />
      </div>
      <div className="max-lg:order-1">
        <HeroSearch marketplaceEnabled />
      </div>
    </div>
  </section>
);

export const SearchBoxOnly = () => (
  <section className="bg-green-900 px-8 py-10">
    <HeroSearch marketplaceEnabled={false} />
  </section>
);
