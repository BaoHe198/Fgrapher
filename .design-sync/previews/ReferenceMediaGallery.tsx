import { ReferenceMediaGallery } from "fgrapher";

const photo = (from: string, to: string, label: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='300' height='300' fill='url(#g)'/><text x='18' y='280' font-family='sans-serif' font-size='24' fill='rgba(255,255,255,0.8)'>${label}</text></svg>`,
  )}`;

const refs = [
  photo("#0f3d33", "#c9a24d", "Đồi chè"),
  photo("#3b2a1a", "#e8d3a8", "Áo dài"),
  photo("#1c2b36", "#8fb3c7", "Hồ Tuyền Lâm"),
  photo("#4a2c2a", "#e7b8a4", "Hoàng hôn"),
];

export const Photos = () => <ReferenceMediaGallery urls={refs.slice(0, 3)} />;

export const PhotosAndVideo = () => (
  <ReferenceMediaGallery
    urls={[
      ...refs,
      "https://res.cloudinary.com/fgrapher/video/upload/v1727400000/references/prewedding-dalat.mp4",
    ]}
  />
);

export const InBookingDetail = () => (
  <div className="flex max-w-xl flex-col gap-4 rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-surface p-5">
    <div className="flex flex-col gap-1">
      <span className="text-heading-md text-text-primary">
        Chụp ảnh cưới ngoại cảnh
      </span>
      <span className="text-body-sm text-text-secondary">
        12/10/2026 · Phường Lâm Viên - Đà Lạt, Tỉnh Lâm Đồng · 8.500.000₫
      </span>
    </div>
    <p className="text-body-md text-text-secondary">
      Tụi mình muốn tông màu ấm, chụp lúc hoàng hôn, có vài kiểu với áo dài
      truyền thống.
    </p>
    <ReferenceMediaGallery
      label="Ảnh mẫu khách gửi"
      urls={refs.slice(1)}
    />
  </div>
);
