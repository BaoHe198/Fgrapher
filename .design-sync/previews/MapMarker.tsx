import { MapMarker } from "fgrapher";

// Brand-palette gradients stand in for portfolio photos (captures are offline).
const photo = (from: string, to: string, label = "") =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='450'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='600' height='450' fill='url(#g)'/><text x='30' y='420' font-family='sans-serif' font-size='24' fill='rgba(255,255,255,0.7)'>${label}</text></svg>`,
  )}`;

// Captures land mid-way through the 400ms develop animation otherwise.
const Still = () => (
  <style>{"[data-slot=fg-image] img{animation:none!important;opacity:1!important;filter:none!important}"}</style>
);


export const States = () => (
  <div className="relative flex h-40 w-[520px] items-center justify-around bg-bg-sunken bg-[linear-gradient(var(--border-subtle)_1px,transparent_1px),linear-gradient(90deg,var(--border-subtle)_1px,transparent_1px)] bg-[size:32px_32px]">
    <MapMarker label="Minh Anh" photoUrl={photo("#0f3d33", "#c9a24d")} price={2000000} />
    <MapMarker label="Ngọc Linh" photoUrl={photo("#3b2a1a", "#e8d3a8")} price={5500000} selected />
    <MapMarker label="Hoàng Phim" photoUrl={photo("#1c2b36", "#8fb3c7")} price={750000} seen />
    <MapMarker label="Studio" photoUrl={photo("#2a1c36", "#c78fb3")} price={1500000} count={4} />
    <MapMarker label="Quốc Hùng" price={null} />
  </div>
);
