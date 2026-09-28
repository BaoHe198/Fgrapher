import { Button, FrameMark } from "fgrapher";

export const Sizes = () => (
  <div className="flex items-end gap-6 text-text-tertiary">
    <FrameMark size={24} />
    <FrameMark size={44} />
    <FrameMark size={72} />
    <FrameMark size={120} />
  </div>
);

export const Tones = () => (
  <div className="flex items-center gap-6">
    <FrameMark className="text-text-tertiary" />
    <FrameMark className="text-text-secondary" />
    <FrameMark className="text-brand-primary" />
    <div className="rounded-[var(--fg-radius-md)] bg-brand-primary p-3">
      <FrameMark className="text-text-on-brand" />
    </div>
  </div>
);

export const EmptyPortfolio = () => (
  <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-[var(--fg-radius-lg)] border border-dashed border-border-default bg-bg-sunken px-6 py-10 text-center text-text-tertiary">
    <FrameMark size={56} />
    <p className="text-body-md font-semibold! text-text-primary">
      Chưa có ảnh nào trong danh mục
    </p>
    <p className="text-body-sm text-text-secondary">
      Thêm ít nhất 6 ảnh để hồ sơ của bạn được hiển thị trong kết quả tìm kiếm.
    </p>
    <Button variant="accent" size="sm">
      Tải ảnh lên
    </Button>
  </div>
);
