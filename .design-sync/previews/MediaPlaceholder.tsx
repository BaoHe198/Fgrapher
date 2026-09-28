import { MediaPlaceholder } from "fgrapher";

export const Tints = () => (
  <div className="grid max-w-[560px] grid-cols-3 gap-3">
    <MediaPlaceholder tint="green-300" height={160} radius={12} label="Ảnh cưới" />
    <MediaPlaceholder tint="gold-200" height={160} radius={12} label="Chân dung" />
    <MediaPlaceholder tint="neutral-200" height={160} radius={12} label="Kỷ yếu" />
  </div>
);

export const PortfolioGrid = () => (
  <div className="grid max-w-lg grid-cols-2 gap-2">
    <MediaPlaceholder tint="green-200" height={240} radius={8} label="Áo dài Hội An" />
    <div className="flex flex-col gap-2">
      <MediaPlaceholder tint="gold-100" height={116} radius={8} />
      <MediaPlaceholder tint="green-100" height={116} radius={8} />
    </div>
  </div>
);

export const Cover = () => (
  <div className="max-w-[560px]">
    <MediaPlaceholder tint="gold-300" height={200} label="Ảnh bìa studio" />
  </div>
);
