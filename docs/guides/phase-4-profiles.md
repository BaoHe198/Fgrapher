# Giai đoạn 4 — Hồ sơ công khai

> Tài liệu lịch sử về thiết kế profile ban đầu.

## Mục tiêu

- Trang hồ sơ công khai.
- Tab portfolio, dịch vụ, đánh giá và thiết bị.
- Sidebar đặt lịch.
- Trình sửa hồ sơ.
- Lưu hồ sơ/follow theo feature flag.

## 1. Vỏ trang hồ sơ

Route `/profile/[username]` là Server Component. Nó:

- tìm user/profile theo username;
- chỉ trả hồ sơ được phép công khai;
- dùng `notFound()` khi không tồn tại;
- tạo metadata/JSON-LD từ dữ liệu công khai;
- không serialize object User đầy đủ sang client.

Header có cover, avatar, tên, role, verification, location và hành động. Ngày sinh
Model chỉ hiển thị nhóm tuổi khi chính sách cho phép, không hiển thị ngày chính xác.

## 2. Nội dung các tab

### Bộ sưu tập (portfolio)

Hiện hiển thị album có media approved. Album không có ảnh được duyệt không xuất hiện
công khai.

### Dịch vụ

Hiển thị tên, mô tả, thời lượng và giá. Booking dùng ID/giá từ server; không tin số
tiền sửa trong client.

### Đánh giá

Hiển thị rating tổng, phân bố sao, review và phản hồi provider. Dữ liệu được phân
trang khi lớn.

### Thiết bị/shop

Chỉ tồn tại khi marketplace bật. Flag tắt phải chặn cả tab, page và API.

## 3. Sidebar đặt lịch

Sidebar chọn dịch vụ/ngày/giờ nhưng availability cuối cùng phải được server kiểm tra
lại khi tạo booking. Trên mobile, sidebar chuyển thành CTA/dialog dễ thao tác.

Tránh:

- gọi availability cho component đang ẩn;
- dùng ngày theo timezone trình duyệt mà không chuẩn hoá;
- giữ slot cũ sau khi service/date đổi;
- cho phép tiếp tục khi provider không nhận booking.

## 4. Trình sửa hồ sơ

Editor cập nhật đúng profile theo role của user. Zod server allow-list field; không cho
đưa `isPublished`, verification hoặc rating vào payload sửa chung.

Các phần:

- thông tin cơ bản;
- location/vùng phục vụ;
- giá và category;
- field riêng theo role;
- ảnh/avatar/cover;
- dịch vụ;
- trạng thái publish.

Publish đi qua service riêng, kiểm tra role, verification và media approved.

## 5. Portfolio và quyền riêng tư

Upload trực tiếp Cloudinary bằng signature ngắn hạn. Server giữ API secret. Người dùng
phải xác nhận quyền dùng ảnh. EXIF/GPS cần được loại bỏ theo cấu hình đã kiểm chứng.

Public query dùng `select` rõ để không trả email, phone, password hash, ngày sinh
thô hoặc dữ liệu KYC.

## 6. Lưu hồ sơ và follow

Saved profile là danh sách riêng của user. Follow/social chỉ hoạt động khi
`SOCIAL_FEED_ENABLED`. Endpoint phải scope `followerId` từ session và cấm tự follow
nếu policy yêu cầu.

## 7. Chia sẻ và QR

Share/QR chỉ mã hoá URL public. URL phải là origin an toàn và profile phải đang public.
QR không cấp quyền truy cập nội dung riêng.

## 8. Kiểm tra

- profile chưa publish/không verified không xem được;
- public payload không có PII;
- album/media pending không lộ;
- role khác nhau có field đúng;
- booking CTA theo trạng thái;
- marketplace/social flag off;
- metadata không chứa email/phone/address;
- mobile, dark mode, keyboard và ảnh fallback.

## Khác với kế hoạch ban đầu

Hệ thống hiện có album, moderation, trash, QR, vùng phục vụ, KYC và Model. Kế hoạch
profile phẳng ban đầu không còn là nguồn thiết kế dữ liệu.
