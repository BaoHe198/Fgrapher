import { MediaLightbox } from "fgrapher";

const noop = () => {};

// 16:9 brand-palette gradients stand in for portfolio photos:
// previews render offline, so remote images would come up empty.
const photo = (from: string, to: string, label: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='1600' height='900'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='1600' height='900' fill='url(#g)'/><text x='60' y='840' font-family='sans-serif' font-size='40' fill='rgba(255,255,255,0.7)'>${label}</text></svg>`,
  )}`;

const album = [
  { url: photo("#0f3d33", "#c9a24d", "Đồi thông Đà Lạt"), title: "Đồi thông", type: "IMAGE" as const },
  { url: photo("#3b2a1a", "#e8d3a8", "Hồ Tuyền Lâm lúc hoàng hôn"), title: "Hồ Tuyền Lâm", type: "IMAGE" as const },
  { url: photo("#1c2b36", "#8fb3c7", "Nhà thờ Con Gà"), title: "Nhà thờ Con Gà", type: "IMAGE" as const },
  { url: photo("#4a1f2e", "#e7b7a3", "Vườn hoa cẩm tú cầu"), title: "Cẩm tú cầu", type: "IMAGE" as const },
];

export const AlbumViewer = () => (
  <MediaLightbox
    items={album}
    index={1}
    onClose={noop}
    onIndexChange={noop}
    title="Ảnh cưới Đà Lạt – Thảo Vy & Quốc Anh"
    description="Chụp ngoại cảnh 2 ngày tại Đà Lạt, 14–15/09/2026."
    categoryLabel="Ảnh cưới"
  />
);

export const SinglePhoto = () => (
  <MediaLightbox
    items={[{ url: photo("#2b2b2b", "#b89b72", "Sony A7 IV + FE 24-70mm GM II") }]}
    index={0}
    onClose={noop}
    onIndexChange={noop}
  />
);
