import { Checkbox } from "fgrapher";

export const Consents = () => (
  <div className="flex flex-col gap-3">
    <Checkbox label="Tôi đồng ý với Điều khoản sử dụng" defaultChecked />
    <Checkbox label="Đồng ý xử lý dữ liệu cá nhân để đặt lịch" defaultChecked />
    <Checkbox label="Nhận email về ưu đãi và sự kiện" />
  </div>
);

export const States = () => (
  <div className="flex flex-col gap-3">
    <Checkbox label="Chưa chọn" />
    <Checkbox label="Đã chọn" defaultChecked />
    <Checkbox label="Không khả dụng" disabled />
    <Checkbox label="Đã chọn, không khả dụng" defaultChecked disabled />
    <Checkbox label="Bạn cần đồng ý để tiếp tục" aria-invalid />
  </div>
);

export const Standalone = () => (
  <div className="flex items-center gap-4">
    <Checkbox aria-label="Chọn buổi chụp 12/10/2026" />
    <Checkbox aria-label="Chọn buổi chụp 15/10/2026" defaultChecked />
  </div>
);
