import { CalendarDays, MessageCircle } from "lucide-react";
import { Button, StickyActionBar } from "fgrapher";

// Fixed to the viewport and hidden from lg up in the app; here it sits in an
// in-flow wrapper with a height and stays visible at the capture width.
export const ProfileBar = () => (
  <div className="relative h-24 w-[390px]">
    <StickyActionBar
      className="absolute lg:block"
      title="Từ 2.000.000₫"
      subtitle="Phản hồi trong 2 giờ · 312 buổi đã chụp"
      secondary={<Button variant="outline" size="icon" aria-label="Nhắn tin"><MessageCircle className="size-4" /></Button>}
      primary={<Button variant="accent"><CalendarDays className="size-4" />Chọn ngày</Button>}
    />
  </div>
);
