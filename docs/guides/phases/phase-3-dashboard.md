# Giai đoạn 3 — Dashboard

> Tài liệu lịch sử về khung dashboard ban đầu.

## Mục tiêu

- Layout và sidebar responsive.
- Trang tổng quan.
- Khu booking, portfolio, tin nhắn, cài đặt.
- Khu marketplace chỉ xuất hiện khi flag bật.

## 1. Layout và sidebar

Dashboard dùng navigation chung phía trên, sidebar trên desktop và menu thay thế trên
mobile. Layout cần:

- giữ nội dung trong bề rộng hợp lý;
- highlight route hiện tại;
- dùng link thật, không chỉ state tab;
- focus và ESC đúng trong menu mobile;
- không mount trùng notification/chat/polling.

Route group `(dashboard)` không xuất hiện trong URL.

## 2. Trang tổng quan

Dashboard home hiển thị số liệu hữu ích như booking sắp tới, tin nhắn chưa đọc, trạng
thái hồ sơ và hành động cần làm. Số liệu phải được scope theo session user.

Tránh:

- query từng card riêng nếu có thể gom;
- hiển thị số 0 khoẻ mạnh khi query bị lỗi;
- tính dữ liệu feature đang tắt;
- tải lịch sử vô hạn.

## 3. Booking

Khu booking có list/calendar, filter trạng thái và trang chi tiết. Cùng một policy che
phone/address/email phải được áp cho list, calendar và detail.

Hành động accept/decline/cancel/complete/no-show gọi service state machine, không cập
nhật trạng thái trực tiếp từ component.

## 4. Portfolio

Kế hoạch ban đầu là tab ảnh phẳng. Hiện hệ thống dùng album, reorder, cover,
moderation và thùng rác. Dashboard phải cho chủ hồ sơ thấy pending/rejected, nhưng
public chỉ nhận approved.

Upload gồm:

- chọn album;
- kiểm tra loại/dung lượng/số lượng;
- xác nhận quyền sử dụng;
- signed Cloudinary upload;
- tạo record và hàng chờ moderation;
- thông báo lỗi/tiến độ rõ.

## 5. Listings và orders

Các trang sản phẩm/đơn hàng thuộc marketplace. Khi `MARKETPLACE_ENABLED=false`:

- sidebar không có link;
- page/API bị chặn;
- count/stats không tính;
- role CAMERA_SHOP không được tạo qua đường vòng.

## 6. Settings

Các nhóm cài đặt có thể gồm:

- hồ sơ/tài khoản;
- role;
- notification preference;
- bảo mật/mật khẩu/email;
- billing khi được bật;
- quyền riêng tư, xuất/xoá dữ liệu;
- theme và ngôn ngữ.

Mutation phải có loading, success/error và không mất dữ liệu form khi lỗi.

## 7. Dữ liệu và hiệu năng

- Server Component lấy dữ liệu ban đầu qua service.
- Client chỉ fetch lại phần cần tương tác.
- Danh sách phân trang.
- Query độc lập có thể chạy song song.
- Polling dùng hook chung, dừng khi tab ẩn.
- Cache không dùng chung cho dữ liệu riêng tư theo user.

## 8. Kiểm tra

- User A không xem/sửa dữ liệu dashboard User B.
- Sidebar/menu mobile hoạt động bằng bàn phím.
- Role khác nhau thấy đúng mục.
- Feature flag off chặn cả UI và API.
- Loading/empty/error đầy đủ.
- Không có request polling trùng.
- Mobile, dark mode, tiếng Việt.

## Khác với kế hoạch ban đầu

Dashboard hiện có nhiều khu vực hơn: service request/offer, verification, compliance,
role change và payment methods. Đọc route hiện tại cùng `docs/FEATURES.md` trước khi
sửa navigation hoặc stats.
