import type { Metadata } from "next";

import { SimplePage } from "@/components/sections/simple-page";

export const metadata: Metadata = {
  title: "Quy chế hoạt động nền tảng — Fgrapher",
};

// Prompt B8, VIỆC 4 — trang mới, KHUNG (không phải văn bản pháp lý hoàn
// chỉnh). Danh sách mục dựa theo cấu trúc "Quy chế hoạt động" thường thấy
// ở các sàn TMĐT trung gian tại Việt Nam (thông tin đơn vị vận hành,
// quyền/nghĩa vụ các bên, quy trình giao dịch, giải quyết tranh chấp) —
// KHÔNG trích dẫn một nghị định cụ thể nào ở đây vì chưa được luật sư xác
// nhận văn bản nào áp dụng cho mô hình của Fgrapher; xem docs/MVP_SCOPE.md
// và CLAUDE.md phần "Về pháp lý".
const SECTIONS = [
  {
    title: "1. Thông tin đơn vị vận hành nền tảng",
    note: "Tên pháp nhân, mã số doanh nghiệp, địa chỉ trụ sở, thông tin liên hệ chính thức của đơn vị vận hành Fgrapher.",
  },
  {
    title: "2. Phạm vi hoạt động của nền tảng",
    note: "Fgrapher là nền tảng trung gian kết nối khách hàng với nhà cung cấp dịch vụ nhiếp ảnh/quay phim/trang điểm/studio trên toàn quốc — không trực tiếp cung cấp dịch vụ, không phải một bên trong giao dịch giữa các thành viên.",
  },
  {
    title: "3. Điều kiện & quy trình đăng ký tài khoản",
    note: "Điều kiện trở thành khách hàng/nhà cung cấp, yêu cầu độ tuổi tối thiểu 18, quy trình xác minh danh tính bắt buộc trước khi hồ sơ nhà cung cấp được công khai.",
  },
  {
    title: "4. Quyền và nghĩa vụ của khách hàng",
    note: "Quyền tìm kiếm/đặt lịch/đánh giá, nghĩa vụ cung cấp thông tin chính xác và thanh toán đúng thỏa thuận với nhà cung cấp.",
  },
  {
    title: "5. Quyền và nghĩa vụ của nhà cung cấp",
    note: "Quyền đăng hồ sơ/nhận đặt lịch, nghĩa vụ đảm bảo chất lượng dịch vụ đúng như mô tả, tuân thủ tiêu chuẩn nội dung.",
  },
  {
    title: "6. Quyền và nghĩa vụ của Fgrapher",
    note: "Vai trò trung gian, trách nhiệm kiểm duyệt nội dung và xác minh danh tính, giới hạn trách nhiệm đối với chất lượng dịch vụ thực tế do nhà cung cấp thực hiện.",
  },
  {
    title: "7. Quy trình giao dịch trên nền tảng",
    note: "Các bước từ tìm kiếm, gửi yêu cầu đặt lịch, xác nhận, đến hoàn tất — hiện chưa có thanh toán trực tuyến qua nền tảng, thỏa thuận thanh toán nằm ngoài Fgrapher giữa khách hàng và nhà cung cấp.",
  },
  {
    title: "8. Cơ chế tiếp nhận và giải quyết khiếu nại, tranh chấp",
    note: "Quy trình báo cáo vi phạm/khiếu nại (xem trang Tiêu chuẩn cộng đồng), thời hạn xử lý, vai trò của Fgrapher khi có tranh chấp giữa các thành viên.",
  },
  {
    title: "9. Biện pháp xử lý vi phạm",
    note: "Các hình thức xử lý: gỡ nội dung, cảnh cáo, tạm khóa, cấm vĩnh viễn — điều kiện áp dụng từng mức.",
  },
  {
    title: "10. Bảo vệ quyền lợi người tiêu dùng",
    note: "Cam kết minh bạch thông tin nhà cung cấp, cơ chế đánh giá công khai, kênh phản ánh độc lập với nhà cung cấp.",
  },
  {
    title: "11. Hiệu lực & sửa đổi quy chế",
    note: "Thời điểm quy chế có hiệu lực, cách thức thông báo khi sửa đổi.",
  },
];

export default function PlatformRulesPage() {
  return (
    <SimplePage
      title="Quy chế hoạt động nền tảng"
      subtitle="Bản khung — nội dung từng mục đang chờ luật sư soạn thảo, chưa có giá trị pháp lý chính thức."
    >
      <p>
        Đây là <strong>khung quy chế hoạt động</strong> liệt kê các mục cần có
        trước khi Fgrapher ra mắt chính thức, theo yêu cầu đối với nền tảng
        thương mại điện tử trung gian. Đây <strong>không phải</strong> là văn
        bản pháp lý hoàn chỉnh — mỗi mục dưới đây cần được luật sư soạn thảo và
        rà soát trước khi công bố là Quy chế hoạt động chính thức.
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
