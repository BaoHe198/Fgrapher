import type { Metadata } from "next";

import { SimplePage } from "@/components/sections/simple-page";

export const metadata: Metadata = { title: "Giới thiệu — Fgrapher" };

export default function AboutPage() {
  return (
    <SimplePage
      title="Giới thiệu về Fgrapher"
      subtitle="Nền tảng kết nối nhiếp ảnh gia, quay phim, chuyên viên trang điểm, studio và cửa hàng máy ảnh với khách hàng đang tìm kiếm họ."
    >
      <p>
        Fgrapher kết nối khách hàng với những người sáng tạo hình ảnh đứng sau
        các buổi chụp họ yêu thích — và kết nối những người sáng tạo đó với
        khách hàng đang tìm kiếm dịch vụ của họ. Xây dựng portfolio, đăng dịch
        vụ, quản lý lịch đặt và được khách hàng tìm thấy, tất cả ở một nơi.
      </p>
      <p>
        Fgrapher hiện đang trong giai đoạn thử nghiệm sớm. Nếu bạn gặp phải điều
        gì đó chưa hoạt động như mong đợi, hãy cho chúng tôi biết — xem trang
        Liên hệ.
      </p>
    </SimplePage>
  );
}
