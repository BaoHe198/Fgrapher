# Giai đoạn 9 — Marketplace thiết bị

> Tài liệu lịch sử. Marketplace hiện nằm sau `MARKETPLACE_ENABLED` và ngoài phạm vi
> MVP đang vận hành.

## Mục tiêu ban đầu

- Cửa hàng đăng sản phẩm bán/cho thuê.
- Người mua tìm kiếm, thêm giỏ và checkout.
- Quản lý đơn hàng.
- Thống kê cho shop.

## 1. Phạm vi khi flag tắt

Server phải chặn:

- `/shop`, chi tiết sản phẩm, cart và checkout;
- dashboard listings/orders;
- API product/cart/order;
- role CAMERA_SHOP ở các luồng tự phục vụ nếu role cũng thuộc feature;
- sitemap, navigation, count và thông báo liên quan.

Dữ liệu cũ có thể được giữ nhưng không xuất hiện công khai.

## 2. Sản phẩm

Sản phẩm có shop owner, loại bán/thuê, category, condition, giá, tồn kho/trạng thái,
ảnh và mô tả. Server:

- kiểm tra owner;
- validate giá/số lượng;
- giới hạn upload;
- chỉ public listing active;
- không tin shopId/userId từ client.

Ảnh dùng Cloudinary và lifecycle xoá tương tự media khác.

## 3. Tìm kiếm shop

Filter có thể gồm loại, category, condition, giá, brand và availability. Dữ liệu phải
phân trang, query có index và category/brand không nên hardcode nếu cần quản trị.

## 4. Giỏ hàng

Cart item gắn với user và product. Giá trong cart chỉ để hiển thị; checkout đọc lại
giá/tồn kho từ database.

Các trường hợp:

- sản phẩm bị tắt sau khi thêm;
- giá thay đổi;
- số lượng vượt tồn;
- một cart có nhiều shop;
- rental date trùng;
- request double-click.

## 5. Checkout

Order nên tách theo shop để quản lý fulfillment/hoàn tiền. Tạo order và giữ tồn kho
cần transaction hoặc cơ chế reservation rõ.

Không đánh dấu đã thanh toán từ client success page. Webhook/IPN xác minh chữ ký và
idempotency.

## 6. Đơn hàng

State machine quy định ai được chuyển trạng thái. Customer không tự đánh dấu đã giao;
shop không tự hoàn thành bước cần xác nhận thanh toán. Event lặp không được trừ tồn
kho/gửi email/cấp quyền hai lần.

Rental cần thêm:

- thời gian thuê;
- đặt cọc;
- tình trạng trước/sau;
- trả trễ/hư hỏng;
- lịch khả dụng;
- tranh chấp.

## 7. Payout cho shop

Kế hoạch Stripe ban đầu chưa giải quyết việc chia tiền trực tiếp cho từng shop. Trước
khi bật marketplace phải chọn:

- nền tảng thu rồi đối soát thủ công;
- cổng hỗ trợ sub-merchant/split payment;
- quy trình hoá đơn, hoàn tiền và tranh chấp.

Đây là quyết định pháp lý/vận hành, không chỉ task code.

## 8. Kiểm tra

- flag off chặn mọi đường;
- user sửa sản phẩm shop khác;
- thay giá/stock trong client;
- checkout lặp;
- nhiều khách mua món cuối;
- webhook lặp/sai thứ tự;
- đơn nhiều shop;
- rental overlap;
- hoàn tiền một phần;
- dữ liệu PII của đơn chỉ cho đúng bên.

## Điều kiện trước khi bật

- merchant/payment hợp lệ ở Việt Nam;
- điều khoản mua bán/cho thuê;
- vận chuyển, hoàn trả và tranh chấp;
- KYC shop;
- kiểm duyệt listing;
- hỗ trợ khách hàng;
- đối soát và payout;
- giám sát fraud.
