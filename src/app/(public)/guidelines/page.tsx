import type { Metadata } from "next";

import { SimplePage } from "@/components/sections/simple-page";

export const metadata: Metadata = { title: "Tiêu chuẩn cộng đồng — Fgrapher" };

export default function GuidelinesPage() {
  return (
    <SimplePage
      title="Tiêu chuẩn cộng đồng"
      subtitle="Áp dụng cho mọi hồ sơ và mọi ảnh đăng tải trên Fgrapher"
    >
      <p>
        Fgrapher lưu trữ ảnh thật của người thật. Những tiêu chuẩn dưới đây tồn
        tại để giữ nền tảng an toàn và chuyên nghiệp cho tất cả mọi người —
        nhiếp ảnh gia, người mẫu, và khách hàng. Mọi tài khoản đều phải tuân
        thủ; vi phạm có thể dẫn đến gỡ nội dung, khóa tài khoản tạm thời, hoặc
        cấm vĩnh viễn.
      </p>

      <h2>Nội dung không được chấp nhận</h2>
      <ul>
        <li>Ảnh khỏa thân dưới mọi hình thức.</li>
        <li>Ảnh khiêu dâm hoặc có tính chất khiêu dâm.</li>
        <li>Ảnh phô bày cơ thể mang tính gợi dục.</li>
        <li>Ảnh của bất kỳ ai dưới 18 tuổi, trong mọi bối cảnh.</li>
        <li>
          Ảnh bạn không có quyền sử dụng — theo Điều 32 Bộ luật Dân sự 2015,
          việc sử dụng hình ảnh cá nhân phải được người đó đồng ý. Bạn phải là
          người trong ảnh, là người chụp, hoặc có sự đồng ý rõ ràng của người
          trong ảnh trước khi đăng tải.
        </li>
      </ul>

      <h2>Yêu cầu về độ tuổi</h2>
      <p>
        Mọi tài khoản Fgrapher — không riêng vai trò nào — đều phải từ 18 tuổi
        trở lên. Đây là điều kiện bắt buộc khi đăng ký, không phải một tùy chọn.
      </p>

      <h2>Ảnh được kiểm duyệt trước khi công khai</h2>
      <p>
        Mọi ảnh portfolio đều ở trạng thái &quot;Đang chờ duyệt&quot; cho đến
        khi đội ngũ Fgrapher xem xét và phê duyệt. Ảnh chưa được duyệt chỉ hiển
        thị cho chính bạn, không xuất hiện trên hồ sơ công khai hay kết quả tìm
        kiếm. Bạn vẫn có thể tạo và chỉnh sửa portfolio ở chế độ nháp trong lúc
        chờ.
      </p>

      <h2>Quy trình xử lý vi phạm — 3 lần khóa tài khoản</h2>
      <p>
        Mỗi lần một ảnh bị từ chối vì vi phạm tiêu chuẩn nội dung (dù do hệ
        thống tự động phát hiện hay do đội ngũ kiểm duyệt), tài khoản của bạn
        nhận một điểm vi phạm. Đến điểm vi phạm thứ 3, tài khoản sẽ tự động bị
        tạm khóa. Trường hợp vi phạm nghiêm trọng (ví dụ nghi ngờ liên quan đến
        người dưới 18 tuổi) có thể bị khóa ngay từ lần đầu và báo cáo cho cơ
        quan chức năng khi pháp luật yêu cầu.
      </p>

      <h2>Khiếu nại khi ảnh bị từ chối</h2>
      <p>
        Nếu bạn cho rằng ảnh của mình bị từ chối nhầm, hãy nhắn tin cho đội ngũ
        hỗ trợ qua trang Liên hệ, nêu rõ ảnh nào và lý do bạn cho là quyết định
        chưa chính xác. Mỗi khiếu nại sẽ được một quản trị viên khác xem xét lại
        độc lập.
      </p>

      <h2>Báo cáo vi phạm</h2>
      <p>
        Mọi hồ sơ đều có tùy chọn &quot;Báo cáo&quot;. Báo cáo về nội dung không
        phù hợp hoặc hồ sơ nghi ngờ thuộc về người dưới 18 tuổi được chuyển vào
        hàng đợi ưu tiên cao và xử lý sớm nhất có thể.
      </p>
    </SimplePage>
  );
}
