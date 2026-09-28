import { SectionHead } from "fgrapher";

export const WithAction = () => (
  <div className="w-[640px]">
    <SectionHead
      title="Nhiếp ảnh gia nổi bật"
      actionLabel="Xem tất cả"
      actionHref="/search?role=photographer"
    />
  </div>
);

export const TitleOnly = () => (
  <div className="w-[640px]">
    <SectionHead title="Lịch đặt của tôi" as="h1" />
  </div>
);

export const LongTitle = () => (
  <div className="w-[480px]">
    <SectionHead
      title="Studio chụp ảnh tại Thành phố Hồ Chí Minh"
      actionLabel="Xem thêm"
      actionHref="/studio/ho-chi-minh"
    />
  </div>
);
