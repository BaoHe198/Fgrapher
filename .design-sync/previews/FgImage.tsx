import { FgImage } from "fgrapher";

// Brand-palette gradients stand in for portfolio photos (captures are offline).
const photo = (from: string, to: string, label = "") =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='450'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='600' height='450' fill='url(#g)'/><text x='30' y='420' font-family='sans-serif' font-size='24' fill='rgba(255,255,255,0.7)'>${label}</text></svg>`,
  )}`;

// Captures land mid-way through the 400ms develop animation otherwise.
const Still = () => (
  <style>{"[data-slot=fg-image] img{animation:none!important;opacity:1!important;filter:none!important}"}</style>
);


export const Ratios = () => (
  <div className="flex items-end gap-3">
    <Still />
    <FgImage src={photo("#0f3d33", "#c9a24d", "4/5")} alt="Ảnh cưới" ratio="4/5" className="w-40" />
    <FgImage src={photo("#3b2a1a", "#e8d3a8", "1/1")} alt="Chân dung" ratio="1/1" className="w-40" />
    <FgImage src={photo("#1c2b36", "#8fb3c7", "4/3")} alt="Kỷ yếu" ratio="4/3" rounded="lg" className="w-52" />
  </div>
);

export const EmptySlot = () => (
  <div className="flex gap-3">
    <FgImage src={null} alt="" ratio="4/5" className="w-40" />
    <FgImage src={null} alt="" ratio="4/5" rounded="lg" className="w-40" />
  </div>
);
