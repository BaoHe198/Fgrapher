import { ReferenceMediaField } from "fgrapher";

const photo = (from: string, to: string, label: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='400' height='400' fill='url(#g)'/><text x='24' y='376' font-family='sans-serif' font-size='28' fill='rgba(255,255,255,0.7)'>${label}</text></svg>`,
  )}`;

const refs = [
  { url: photo("#0f3d33", "#c9a24d", "Đà Lạt"), publicId: "r1" },
  { url: photo("#3b2a1a", "#e8d3a8", "Áo dài"), publicId: "r2" },
  { url: photo("#1c2b36", "#8fb3c7", "Hoàng hôn"), publicId: "r3" },
  { url: photo("#4a1f2a", "#e6b8a2", "Cô dâu"), publicId: "r4" },
  { url: photo("#23303b", "#c9a24d", "Phố cổ"), publicId: "r5" },
];

const noop = () => {};

export const Empty = () => (
  <div className="w-[440px]">
    <ReferenceMediaField value={[]} onChange={noop} max={5} purpose="request" />
  </div>
);

export const WithReferences = () => (
  <div className="w-[440px]">
    <ReferenceMediaField
      value={refs.slice(0, 3)}
      onChange={noop}
      max={5}
      purpose="booking"
    />
  </div>
);

export const Full = () => (
  <div className="w-[440px]">
    <ReferenceMediaField value={refs} onChange={noop} max={5} purpose="request" />
  </div>
);
