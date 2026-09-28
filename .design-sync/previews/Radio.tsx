import { Radio } from "fgrapher";

export const DurationGroup = () => (
  <fieldset className="flex flex-col gap-3">
    <legend className="mb-3 text-body-sm font-semibold! text-text-primary">
      Thời lượng buổi chụp
    </legend>
    <Radio name="duration" label="2 giờ · 1.500.000₫" />
    <Radio name="duration" label="Nửa ngày (4 giờ) · 2.800.000₫" defaultChecked />
    <Radio name="duration" label="Cả ngày (8 giờ) · 5.000.000₫" />
  </fieldset>
);

export const States = () => (
  <div className="flex flex-col gap-3">
    <Radio name="s1" label="Chưa chọn" />
    <Radio name="s2" label="Đã chọn" defaultChecked />
    <Radio name="s3" label="Hết lịch ngày 12/10/2026" disabled />
    <Radio name="s4" label="Đã chọn, không thể đổi" defaultChecked disabled />
  </div>
);

export const Inline = () => (
  <div className="flex items-center gap-6">
    <Radio name="sort" label="Phù hợp nhất" defaultChecked />
    <Radio name="sort" label="Đánh giá cao" />
    <Radio name="sort" label="Giá thấp" />
  </div>
);
