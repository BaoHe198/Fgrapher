import { SimplePage } from "fgrapher";

export const About = () => (
  <SimplePage
    title="Giới thiệu Fgrapher"
    subtitle="Nơi khách hàng tìm đúng ekip chụp ảnh, quay phim và trang điểm trên toàn quốc."
  >
    <p>
      Fgrapher kết nối bạn với nhiếp ảnh gia, quay phim, chuyên viên trang
      điểm, người mẫu, studio và cửa hàng trang phục đã được xác minh danh
      tính. Mỗi hồ sơ hiển thị portfolio đã qua kiểm duyệt, bảng giá dịch vụ
      và lịch trống, để bạn đặt lịch mà không phải nhắn hỏi từng người.
    </p>
    <h2>Chúng tôi làm gì</h2>
    <ul>
      <li>Tìm kiếm nghệ sĩ theo tỉnh/thành, phong cách và ngân sách.</li>
      <li>Đặt lịch trực tiếp, nhận xác nhận trong vòng 24 giờ.</li>
      <li>Nhắn tin với nghệ sĩ và đánh giá sau mỗi buổi chụp.</li>
    </ul>
  </SimplePage>
);

export const Privacy = () => (
  <SimplePage
    title="Chính sách bảo mật"
    subtitle="Cập nhật lần cuối ngày 23/08/2026"
  >
    <p>
      Chính sách này giải thích Fgrapher thu thập những dữ liệu cá nhân nào,
      dùng vào mục đích gì và bạn có những quyền gì đối với dữ liệu của mình.
    </p>
    <h2>1. Dữ liệu chúng tôi thu thập</h2>
    <ol>
      <li>Thông tin tài khoản: họ tên, email, số điện thoại, ngày sinh.</li>
      <li>
        Ảnh giấy tờ tùy thân của nhà cung cấp, lưu riêng và tự xóa sau 90
        ngày.
      </li>
      <li>Lịch sử đặt lịch, tin nhắn và đánh giá trên nền tảng.</li>
    </ol>
    <h2>2. Quyền của bạn</h2>
    <p>
      Bạn có thể xuất toàn bộ dữ liệu hoặc yêu cầu xóa tài khoản bất cứ lúc
      nào tại Cài đặt → Quyền riêng tư.
    </p>
  </SimplePage>
);

export const TitleOnly = () => (
  <SimplePage title="Tiêu chuẩn cộng đồng">
    <p>
      Fgrapher không chấp nhận nội dung khỏa thân, gợi dục hoặc vi phạm bản
      quyền. Mọi ảnh portfolio được kiểm duyệt trước khi hiển thị công khai.
    </p>
    <p>
      Nếu bạn thấy hồ sơ hoặc bài đăng vi phạm, hãy dùng nút Báo cáo ngay
      trên trang đó — đội ngũ quản trị sẽ xem xét trong vòng 48 giờ.
    </p>
  </SimplePage>
);
