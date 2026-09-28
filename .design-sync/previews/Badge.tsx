import { Badge } from "fgrapher";
import { BadgeCheckIcon, ClockIcon } from "lucide-react";

export const BrandTones = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge variant="success">Đã xác nhận</Badge>
    <Badge variant="warning">Chờ phản hồi</Badge>
    <Badge variant="accent">Nổi bật</Badge>
    <Badge variant="neutral">Đã hoàn thành</Badge>
  </div>
);

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge>Nhiếp ảnh gia</Badge>
    <Badge variant="secondary">Studio</Badge>
    <Badge variant="destructive">Đã hủy</Badge>
    <Badge variant="outline">Trang điểm</Badge>
    <Badge variant="ghost">Người mẫu</Badge>
    <Badge variant="link">Xem thêm</Badge>
  </div>
);

export const WithIcon = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge variant="success">
      <BadgeCheckIcon data-icon="inline-start" />
      Đã xác minh
    </Badge>
    <Badge variant="warning">
      <ClockIcon data-icon="inline-start" />
      Lịch 12/10/2026
    </Badge>
  </div>
);
