import type { Metadata } from "next";

import { SimplePage } from "@/components/sections/simple-page";

export const metadata: Metadata = { title: "Trung tâm hỗ trợ — Fgrapher" };

const FAQS = [
  {
    q: "Làm sao để trở thành nhà cung cấp?",
    a: "Đăng ký và chọn vai trò phù hợp với bạn — Nhiếp ảnh gia, Quay phim, Chuyên viên trang điểm, Studio, hoặc Cửa hàng máy ảnh. Bạn có thể thêm hoặc đổi vai trò bất cứ lúc nào trong phần Cài đặt.",
  },
  {
    q: "Đặt lịch hoạt động như thế nào?",
    a: "Khách hàng chọn một dịch vụ và một khung giờ trống trên hồ sơ nhà cung cấp rồi gửi yêu cầu đặt lịch. Nhà cung cấp có thể chấp nhận hoặc từ chối yêu cầu ngay trong bảng điều khiển của mình.",
  },
  {
    q: "Fgrapher có miễn phí không?",
    a: "Duyệt và đặt lịch hoàn toàn miễn phí với khách hàng. Vai trò nhà cung cấp hiện được gán gói thủ công qua đội ngũ Fgrapher — tính năng đăng ký gói tự động qua thanh toán trực tuyến chưa được mở tại giai đoạn này.",
  },
  {
    q: "Làm sao để liên hệ hỗ trợ?",
    a: "Dùng trang Liên hệ, đội ngũ Fgrapher sẽ phản hồi sớm nhất có thể.",
  },
];

export default function HelpPage() {
  return (
    <SimplePage
      title="Trung tâm hỗ trợ"
      subtitle="Giải đáp các câu hỏi thường gặp."
    >
      <div className="flex flex-col gap-6">
        {FAQS.map((item) => (
          <div key={item.q} className="flex flex-col gap-1.5">
            <h2 className="text-heading-md text-text-primary">{item.q}</h2>
            <p>{item.a}</p>
          </div>
        ))}
      </div>
    </SimplePage>
  );
}
