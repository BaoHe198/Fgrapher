import { Images, Search } from "lucide-react";
import { Button, EmptyState, ErrorState } from "fgrapher";

export const Empty = () => (
  <div className="max-w-xl">
    <EmptyState icon={<Images />} title="Chưa có album nào" description="Nhắn tin để xin thêm ảnh mẫu." primaryAction={<Button size="sm">Nhắn tin</Button>} />
  </div>
);

export const EmptySearch = () => (
  <div className="max-w-xl">
    <EmptyState icon={<Search />} title="Không có nghệ sĩ nào còn lịch ngày 12/10/2026" description="Thử bỏ bớt bộ lọc hoặc chọn ngày khác." primaryAction={<Button size="sm" variant="outline">Xóa tất cả bộ lọc</Button>} />
  </div>
);

export const Error = () => (
  <div className="max-w-xl">
    <ErrorState title="Không tải được kết quả" description="Kết nối bị gián đoạn." kept="Bộ lọc của bạn vẫn được giữ." primaryAction={<Button size="sm" variant="outline">Thử lại</Button>} />
  </div>
);
