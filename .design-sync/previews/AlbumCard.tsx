import { AlbumCard } from "fgrapher";

// Brand-palette gradients stand in for portfolio photos (captures are offline).
const photo = (from: string, to: string, label = "") =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='450'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='600' height='450' fill='url(#g)'/><text x='30' y='420' font-family='sans-serif' font-size='24' fill='rgba(255,255,255,0.7)'>${label}</text></svg>`,
  )}`;

// Captures land mid-way through the 400ms develop animation otherwise.
const Still = () => (
  <style>{"[data-slot=fg-image] img{animation:none!important;opacity:1!important;filter:none!important}"}</style>
);


export const Albums = () => (
  <div className="grid w-[860px] grid-cols-3 gap-5">
    <Still />
    <AlbumCard href="#" title="Cưới Đà Lạt – Thảo Vy & Quốc Anh" description="Hai ngày ngoại cảnh ở đồi thông Đa Phú và hồ Tuyền Lâm, chụp theo phong cách tự nhiên." coverUrl={photo("#0f3d33", "#c9a24d")} countLabel="48 ảnh" byline="Minh Anh Nhiếp Ảnh · Cưới" />
    <AlbumCard href="#" title="Kỷ yếu 12A1 – THPT Nguyễn Du" description="Một buổi sáng ở sân trường và công viên Gia Định với 42 bạn và cô chủ nhiệm." coverUrl={photo("#1c2b36", "#8fb3c7")} countLabel="120 ảnh" byline="Minh Anh Nhiếp Ảnh · Kỷ yếu" />
    <AlbumCard href="#" title="Áo dài Tết – Phố cổ Hội An" coverUrl={photo("#3b2a1a", "#e8d3a8")} countLabel="36 ảnh" byline="Minh Anh Nhiếp Ảnh · Chân dung" />
  </div>
);
