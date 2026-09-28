import { HeroContactSheet } from "fgrapher";

// Brand-palette gradients stand in for the hero artwork: previews render
// offline, so remote images would come up empty.
const photo = (from: string, to: string, label: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='600' height='600' fill='url(#g)'/><circle cx='420' cy='180' r='90' fill='rgba(255,255,255,0.12)'/><text x='36' y='560' font-family='sans-serif' font-size='34' fill='rgba(255,255,255,0.75)'>${label}</text></svg>`,
  )}`;

const photos = [
  { url: photo("#0f3d33", "#c9a24d", "Nhiếp ảnh gia"), alt: "Nhiếp ảnh gia tác nghiệp lúc hoàng hôn" },
  { url: photo("#3b2a1a", "#e8d3a8", "Trang điểm"), alt: "Chuyên viên trang điểm đang trang điểm cho khách" },
  { url: photo("#1c2b36", "#8fb3c7", "Quay phim"), alt: "Quay phim đang ghi hình bằng máy quay chuyên nghiệp" },
  { url: photo("#2a2320", "#b88a5a", "Studio"), alt: "Không gian studio với đèn chụp ảnh chuyên nghiệp" },
];

const swapSet = [
  { url: photo("#274b3f", "#f0d9a0", "Ảnh cưới Đà Lạt"), alt: "Cặp đôi chụp ảnh cưới ở Đà Lạt" },
  { url: photo("#4a2c2a", "#e7b8a4", "Áo dài Tết"), alt: "Chân dung áo dài ngày Tết" },
  { url: photo("#1d2f3a", "#a8c6d4", "Kỷ yếu"), alt: "Lớp học chụp kỷ yếu ngoài trời" },
  { url: photo("#332a1c", "#d9c08c", "Sản phẩm"), alt: "Chụp ảnh sản phẩm trong studio" },
];

// The frames "develop" in with a 900ms CSS fade from opacity 0; a static
// capture lands mid-fade and shows empty tiles. Pin them at their settled
// state (preview-only; the app keeps the animation).
const Settled = () => (
  <style>{"[data-hero-still] img{animation:none!important}"}</style>
);

export const LandingHero = () => (
  <section data-hero-still className="bg-green-900 text-gold-50">
    <Settled />
    <div className="grid grid-cols-[1.4fr_1fr] items-center gap-10 px-8 py-10">
      <h1 className="m-0 text-display-lg tracking-[-0.02em]">
        Tìm nghệ sĩ giúp bạn lưu giữ những kỷ niệm đẹp nhất
      </h1>
      <HeroContactSheet photos={photos} />
    </div>
  </section>
);

// Eight photos: each frame later swaps once to its second photo. Here the
// seasonal set leads, so the frames show different artwork than LandingHero.
export const WithSwapSet = () => (
  <section data-hero-still className="bg-green-900 text-gold-50">
    <Settled />
    <div className="grid grid-cols-[1.4fr_1fr] items-center gap-10 px-8 py-10">
      <div className="flex flex-col gap-3">
        <h1 className="m-0 text-display-md tracking-[-0.02em]">
          Mùa cưới, áo dài Tết, kỷ yếu — đặt lịch chụp trên toàn quốc
        </h1>
        <p className="m-0 text-body-lg text-green-200">
          Hơn 300 nhiếp ảnh gia, studio và chuyên viên trang điểm đã xác minh danh tính.
        </p>
      </div>
      <HeroContactSheet photos={[...swapSet, ...photos]} />
    </div>
  </section>
);
