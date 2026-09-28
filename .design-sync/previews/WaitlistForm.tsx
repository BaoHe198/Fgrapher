import { WaitlistForm } from "fgrapher";

export const Photographer = () => (
  <WaitlistForm provinceId="p-kontum" role="PHOTOGRAPHER" />
);

export const InEmptyState = () => (
  <div className="flex max-w-md flex-col items-center gap-3 rounded-[var(--fg-radius-lg)] bg-surface-card p-6 text-center shadow-[var(--shadow-sm)]">
    <p className="text-heading-sm text-text-primary">
      Chưa có chuyên viên trang điểm ở Quảng Ngãi
    </p>
    <p className="text-body-sm text-text-secondary">
      Thử mở rộng khu vực, hoặc để lại email để được báo khi có người đăng ký.
    </p>
    <WaitlistForm provinceId="p-quangngai" role="MAKEUP_ARTIST" />
  </div>
);
