# Giai đoạn 10 — Đánh giá và xếp hạng

> Tài liệu lịch sử của hệ thống review.

## Mục tiêu

- Chỉ khách đủ điều kiện mới đánh giá.
- Rating sao và nội dung.
- Nhà cung cấp phản hồi.
- Tổng hợp điểm chính xác.
- Báo cáo/kiểm duyệt review.

## 1. Điều kiện đánh giá

Review gắn với booking hoàn thành. Server kiểm tra:

- người gọi là customer của booking;
- booking đúng trạng thái;
- chưa có review nếu policy chỉ cho một lần;
- rating trong khoảng hợp lệ;
- nội dung đúng giới hạn.

Ẩn nút ở UI không thay thế kiểm tra server.

## 2. Component

- `StarInput`: chọn 1–5 sao bằng chuột và bàn phím, có label.
- `StarRating`: chỉ hiển thị, không giả số review.
- `RatingSummary`: điểm trung bình, count và phân bố.
- `ReviewItem`: tác giả, thời gian, nội dung và phản hồi.

Màu sao cần đủ tương phản; screen reader phải nghe được giá trị.

## 3. Tạo và sửa review

Service sở hữu policy. Nếu cho sửa:

- chỉ tác giả;
- có thời hạn nếu policy yêu cầu;
- tổng hợp rating cập nhật nhất quán;
- lịch sử/audit khi cần xử lý tranh chấp.

Không nhận `reviewedId` tuỳ ý nếu có thể suy ra từ booking.

## 4. Phản hồi của nhà cung cấp

Chỉ user được review mới phản hồi. Một response có thể tạo/sửa theo policy, không cho
người khác giả danh. Nội dung qua validation và moderation/report giống user content.

## 5. Tổng hợp rating

Nguồn điểm phải nhất quán. Có thể tính từ Review bằng aggregate/groupBy hoặc cập nhật
counter cache trong transaction. Không để một route cập nhật `avgRating` còn route
khác quên.

Khi review bị ẩn/xoá, điểm và count phải phản ánh policy.

## 6. Review sản phẩm

Phần này chỉ dùng khi marketplace bật. Điều kiện nên gắn với order đã mua/nhận hàng,
không chỉ tài khoản đăng nhập.

## 7. Kiểm duyệt

Người dùng có thể report review. Admin xem report, nội dung và ngữ cảnh rồi chọn giữ,
ẩn hoặc xử lý tài khoản. Mọi admin mutation ghi audit.

Không xoá review chỉ vì điểm thấp; chỉ xử lý theo chính sách nội dung/gian lận.

## 8. Kiểm tra

- người ngoài booking;
- provider tự review mình;
- booking chưa hoàn tất;
- hai request tạo review đồng thời;
- sửa review người khác;
- response người khác;
- review bị ẩn và aggregate;
- zero review hiển thị “Mới” thay vì điểm giả;
- phân trang và hiệu năng aggregate;
- keyboard/screen reader.

## Khác với kế hoạch ban đầu

Review hiện gắn với booking và có service/route riêng. Hãy đọc
`src/services/reviews.ts`; không tính rating độc lập trong component.
