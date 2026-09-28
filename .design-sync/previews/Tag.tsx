import { Tag } from "fgrapher";

export const CategoryFilter = () => (
  <div className="flex max-w-[520px] flex-wrap gap-2">
    <Tag selected>Ảnh cưới</Tag>
    <Tag>Kỷ yếu</Tag>
    <Tag selected>Chân dung</Tag>
    <Tag>Sự kiện</Tag>
    <Tag>Sản phẩm</Tag>
    <Tag>Gia đình</Tag>
  </div>
);

export const States = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Tag>Chưa chọn</Tag>
    <Tag selected>Đã chọn</Tag>
    <Tag disabled>Hết lịch</Tag>
  </div>
);
