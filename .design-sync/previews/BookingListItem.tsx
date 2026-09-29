import { MessageCircle } from "lucide-react";
import { BookingListItem, Button } from "fgrapher";

const base = {
  date: "2026-10-12",
  startTime: "06:00",
  endTime: "14:00",
  currency: "VND",
  locationType: "OUTDOOR",
  locationAddress: "Đồi thông Đa Phú, Phường Xuân Hương, Tỉnh Lâm Đồng",
  party: { name: "Minh Anh Nhiếp Ảnh", avatar: null },
  reviewed: false,
};

export const Pending = () => (
  <div className="w-[820px]">
    <BookingListItem
      now={Date.now()}
      asProvider={false}
      booking={{ ...base, id: "b1", status: "PENDING", totalPrice: 5500000, serviceName: "Ảnh cưới ngoại cảnh", expiresAt: new Date(Date.now() + 47 * 3600000).toISOString() }}
      actions={<><Button size="sm" variant="outline"><MessageCircle className="size-4" />Nhắn tin</Button><Button size="sm" variant="ghost">Hủy yêu cầu</Button></>}
    />
  </div>
);

export const ReviewDue = () => (
  <div className="w-[820px]">
    <BookingListItem
      now={Date.now()}
      asProvider={false}
      booking={{ ...base, id: "b2", status: "COMPLETED", totalPrice: 2000000, serviceName: "Chân dung áo dài", expiresAt: null, locationType: "PROVIDER", locationAddress: null }}
      actions={<Button size="sm" variant="outline">Xem chi tiết</Button>}
    />
  </div>
);
