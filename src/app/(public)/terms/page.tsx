import type { Metadata } from "next";

import { SimplePage } from "@/components/sections/simple-page";

export const metadata: Metadata = { title: "Điều khoản dịch vụ — Fgrapher" };

// Prompt B8, VIỆC 4 — đây là KHUNG (danh sách mục cần có), không phải văn
// bản pháp lý hoàn chỉnh. Nội dung từng mục CHƯA được luật sư soạn/duyệt —
// không dùng bản này làm điều khoản chính thức khi ra mắt thật. Danh sách
// mục dựa trên các quy định được trích trong CLAUDE.md (Luật Bảo vệ dữ
// liệu cá nhân 91/2025, Nghị định 356/2025, Điều 32 BLDS 2015) và các tính
// năng thực tế đã triển khai trong sản phẩm — xem docs/MVP_SCOPE.md.
const SECTIONS = [
  {
    title: "1. Giới thiệu & phạm vi áp dụng",
    note: "Định nghĩa các bên (Fgrapher, khách hàng, nhà cung cấp), phạm vi địa lý (toàn quốc Việt Nam), thời điểm điều khoản có hiệu lực.",
  },
  {
    title: "2. Điều kiện sử dụng & tài khoản",
    note: "Yêu cầu độ tuổi tối thiểu 18 cho mọi vai trò, nghĩa vụ cung cấp thông tin chính xác, một người một tài khoản, trách nhiệm bảo mật thông tin đăng nhập.",
  },
  {
    title: "3. Xác minh danh tính nhà cung cấp",
    note: "Yêu cầu xác minh danh tính trước khi hồ sơ được công khai (áp dụng mọi vai trò nhà cung cấp), quy trình lưu trữ và tự xóa ảnh giấy tờ sau 90 ngày.",
  },
  {
    title: "4. Vai trò trung gian của Fgrapher",
    note: "Fgrapher là nền tảng trung gian kết nối, không phải bên tuyển dụng hay đại diện của bất kỳ nhà cung cấp nào (bao gồm vai trò Người mẫu), không phải một bên trong thỏa thuận đặt lịch giữa các thành viên.",
  },
  {
    title: "5. Đặt lịch, hủy lịch & giải quyết tranh chấp giữa các bên",
    note: "Quy trình đặt lịch, trạng thái đơn, chính sách hủy/hết hạn tự động, vai trò của Fgrapher khi có tranh chấp giữa khách hàng và nhà cung cấp.",
  },
  {
    title: "6. Thanh toán & gói dịch vụ",
    note: "Hiện tại KHÔNG có cổng thanh toán trực tuyến — gói thuê bao được gán thủ công qua quản trị viên. Mục này cần làm rõ hình thức thanh toán ngoài nền tảng (nếu có) và trách nhiệm của Fgrapher.",
  },
  {
    title: "7. Nội dung & kiểm duyệt",
    note: "Tiêu chuẩn nội dung (xem trang Tiêu chuẩn cộng đồng), quy trình kiểm duyệt trước khi công khai, hậu quả vi phạm (gỡ nội dung, khóa tài khoản, cấm vĩnh viễn).",
  },
  {
    title: "8. Đình chỉ & chấm dứt tài khoản",
    note: "Các trường hợp Fgrapher có quyền đình chỉ/xóa tài khoản, quyền khiếu nại của người dùng.",
  },
  {
    title: "9. Giới hạn trách nhiệm & bồi thường",
    note: "Phạm vi trách nhiệm của Fgrapher đối với chất lượng dịch vụ do nhà cung cấp thực hiện, thiệt hại phát sinh giữa các thành viên.",
  },
  {
    title: "10. Luật áp dụng & giải quyết tranh chấp",
    note: "Luật Việt Nam áp dụng, cơ quan/hình thức giải quyết tranh chấp với Fgrapher.",
  },
  {
    title: "11. Thay đổi điều khoản",
    note: "Cách thức và thời hạn thông báo khi điều khoản thay đổi.",
  },
  {
    title: "12. Liên hệ",
    note: "Thông tin liên hệ chính thức của đơn vị vận hành Fgrapher.",
  },
];

export default function TermsPage() {
  return (
    <SimplePage
      title="Điều khoản dịch vụ"
      subtitle="Bản khung — nội dung từng mục đang chờ luật sư soạn thảo, chưa có giá trị pháp lý chính thức."
    >
      <p>
        Đây là <strong>khung điều khoản</strong> liệt kê các mục cần có trước
        khi Fgrapher ra mắt chính thức. Đây <strong>không phải</strong> là văn
        bản pháp lý hoàn chỉnh — mỗi mục dưới đây cần được luật sư soạn thảo và
        rà soát trước khi công bố là Điều khoản dịch vụ chính thức.
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
