import { ProductImageUploader } from "fgrapher";

const photo = (from: string, to: string, label: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='400' height='400' fill='url(#g)'/><circle cx='200' cy='190' r='92' fill='rgba(0,0,0,0.35)'/><circle cx='200' cy='190' r='56' fill='rgba(255,255,255,0.18)'/><text x='24' y='376' font-family='sans-serif' font-size='26' fill='rgba(255,255,255,0.75)'>${label}</text></svg>`,
  )}`;

const images = [
  { url: photo("#1a1a1a", "#5a5a5a", "Sony A7 IV"), publicId: "i1" },
  { url: photo("#23303b", "#8fb3c7", "Mặt sau"), publicId: "i2" },
  { url: photo("#2b2118", "#c9a24d", "Ống kính 24-70"), publicId: "i3" },
];

const noop = () => {};

export const Empty = () => (
  <div className="w-[520px]">
    <ProductImageUploader images={[]} onChange={noop} />
  </div>
);

export const WithPhotos = () => (
  <div className="w-[520px]">
    <ProductImageUploader images={images} onChange={noop} />
  </div>
);
