import { Button } from "fgrapher";

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button>Đặt lịch ngay</Button>
    <Button variant="accent">Tìm kiếm</Button>
    <Button variant="secondary">Xem hồ sơ</Button>
    <Button variant="outline">Lưu nháp</Button>
    <Button variant="ghost">Để sau</Button>
    <Button variant="destructive">Hủy lịch</Button>
    <Button variant="link">Xem tất cả</Button>
  </div>
);

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button size="sm">Nhỏ</Button>
    <Button size="md">Vừa</Button>
    <Button size="lg">Trở thành nhà cung cấp</Button>
  </div>
);

export const States = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button disabled>Đang gửi…</Button>
    <Button variant="secondary" disabled>
      Hết chỗ
    </Button>
    <Button variant="accent" size="lg" className="w-full max-w-sm">
      Gửi yêu cầu đặt lịch
    </Button>
  </div>
);
