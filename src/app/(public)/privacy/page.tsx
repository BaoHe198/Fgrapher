import Link from "next/link";
import type { Metadata } from "next";

import { SimplePage } from "@/components/sections/simple-page";

export const metadata: Metadata = { title: "Chính sách bảo mật — Fgrapher" };

// Prompt B8, VIỆC 4 — KHUNG, không phải văn bản pháp lý hoàn chỉnh. Cấu
// trúc mục dựa theo Luật Bảo vệ dữ liệu cá nhân 91/2025 và Nghị định
// 356/2025 được trích dẫn trong CLAUDE.md — nội dung thật CHƯA được luật
// sư soạn/duyệt. Mục 6 tham chiếu hạ tầng tuân thủ thật đã triển khai
// (ConsentRecord/DataRequest/AuditLog, trang /dashboard/settings/data) chứ
// không phải nội dung suy diễn.
const SECTIONS = [
  {
    title: "1. Dữ liệu cá nhân được thu thập",
    note: "Thông tin tài khoản (họ tên, email, số điện thoại, ngày sinh), nội dung hồ sơ (ảnh, video, mô tả), dữ liệu hoạt động (đặt lịch, nhắn tin), ảnh giấy tờ tùy thân dùng để xác minh danh tính.",
  },
  {
    title: "2. Mục đích xử lý dữ liệu",
    note: "Vận hành tài khoản, kết nối khách hàng với nhà cung cấp, xử lý đặt lịch, xác minh danh tính, tuân thủ nghĩa vụ pháp luật. Đồng ý cho từng mục đích (bao gồm tiếp thị) được lưu tách biệt, có bằng chứng thời gian và phiên bản chính sách — không dùng checkbox gộp.",
  },
  {
    title: "3. Cơ sở pháp lý xử lý dữ liệu",
    note: "Sự đồng ý của chủ thể dữ liệu, thực hiện hợp đồng cung cấp dịch vụ, tuân thủ nghĩa vụ pháp luật.",
  },
  {
    title: "4. Thời gian lưu trữ",
    note: "Dữ liệu tài khoản lưu trong thời gian tài khoản hoạt động. Ảnh giấy tờ tùy thân tự động xóa sau 90 ngày kể từ khi xác minh xong.",
  },
  {
    title: "5. Chia sẻ dữ liệu với bên thứ ba",
    note: "Danh sách nhà cung cấp dịch vụ kỹ thuật (lưu trữ ảnh/video, gửi email, v.v.) có thể tiếp cận dữ liệu, và điều kiện chia sẻ.",
  },
  {
    title: "6. Quyền của chủ thể dữ liệu",
    note: (
      <>
        Quyền truy cập, chỉnh sửa, xuất, và yêu cầu xóa dữ liệu cá nhân có thể
        thực hiện tại{" "}
        <Link
          href="/dashboard/settings/data"
          className="text-text-link hover:underline"
        >
          Cài đặt → Dữ liệu &amp; quyền riêng tư
        </Link>
        . Mục này cần bổ sung thời hạn phản hồi yêu cầu và quy trình xác minh
        danh tính người yêu cầu.
      </>
    ),
  },
  {
    title: "7. Bảo mật dữ liệu",
    note: "Biện pháp kỹ thuật và tổ chức bảo vệ dữ liệu, quy trình ghi nhận và thông báo khi có sự cố lộ dữ liệu (AuditLog cho truy cập ảnh giấy tờ tùy thân đã triển khai).",
  },
  {
    title: "8. Dữ liệu của người chưa thành niên",
    note: "Mọi tài khoản Fgrapher yêu cầu từ 18 tuổi trở lên — mục này xác nhận nền tảng không chủ đích thu thập dữ liệu của người dưới 18 tuổi.",
  },
  {
    title: "9. Thay đổi chính sách",
    note: "Cách thức và thời hạn thông báo khi chính sách thay đổi.",
  },
  {
    title: "10. Liên hệ",
    note: "Thông tin liên hệ của đơn vị kiểm soát dữ liệu (Fgrapher) và đầu mối tiếp nhận yêu cầu về dữ liệu cá nhân.",
  },
];

export default function PrivacyPage() {
  return (
    <SimplePage
      title="Chính sách bảo mật"
      subtitle="Bản khung — nội dung từng mục đang chờ luật sư soạn thảo, chưa có giá trị pháp lý chính thức."
    >
      <p>
        Đây là <strong>khung chính sách bảo mật</strong> liệt kê các mục cần có
        trước khi Fgrapher ra mắt chính thức. Đây <strong>không phải</strong> là
        văn bản pháp lý hoàn chỉnh — mỗi mục dưới đây cần được luật sư soạn thảo
        và rà soát trước khi công bố là Chính sách bảo mật chính thức.
      </p>
      {SECTIONS.map((section) => (
        <div key={section.title} className="flex flex-col gap-1">
          <h2>{section.title}</h2>
          <p className="text-body-sm text-text-tertiary">{section.note}</p>
          <p className="italic">Nội dung chờ luật sư soạn.</p>
        </div>
      ))}
    </SimplePage>
  );
}
