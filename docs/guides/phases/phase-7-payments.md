# Giai đoạn 7 — Gói dịch vụ và thanh toán

> Tài liệu lịch sử. Kế hoạch ban đầu tập trung vào Stripe; Stripe hiện bị tắt theo
> ràng buộc kinh doanh tại Việt Nam. Không dùng hướng dẫn cũ để bật thu tiền.

## Mục tiêu ban đầu

- Gói theo vai trò.
- Checkout và portal quản lý thanh toán.
- Webhook cập nhật subscription.
- Chặn quyền khi gói hết hiệu lực.

## 1. Trạng thái hiện tại

`BILLING_ENABLED` kiểm soát Stripe và mặc định tắt. `FREE_ROLE_GRANT_ENABLED` là
policy riêng quyết định có cấp gói miễn phí không. MoMo, ZaloPay và chuyển khoản có
flag độc lập và chỉ bật khi credential/quy trình đối soát sẵn sàng.

Không coi “Stripe tắt” là lý do tự động cấp miễn phí; hai quyết định phải tách nhau.

## 2. Mô hình subscription

Subscription gắn với `UserRole`, không chỉ User. Một tài khoản nhiều vai trò có thể
có trạng thái gói khác nhau.

Các trạng thái phải có nghĩa rõ:

- chờ thanh toán;
- trial/active;
- quá hạn/grace;
- hết hạn/cancelled;
- free/manual.

Helper quyền dùng một nguồn chung để quyết định gói còn usable. UI, API, cron và admin
không tự viết lại quy tắc.

## 3. Payment intent

Payment intent lưu:

- user và role/gói;
- số tiền/currency;
- provider thanh toán;
- mã tham chiếu;
- thời hạn;
- trạng thái;
- provider transaction ID khi có.

Số tiền lấy từ server. Intent hết hạn không được xác nhận. Một intent thành công chỉ
cấp quyền một lần.

## 4. Webhook/IPN

Không tin trang success của trình duyệt. Server:

1. đọc raw body khi provider yêu cầu;
2. xác minh chữ ký;
3. tìm intent/subscription;
4. kiểm tra số tiền, currency và trạng thái;
5. dedupe bằng event/provider transaction ID;
6. chuyển state hợp lệ trong transaction;
7. trả response để provider không retry vô hạn.

Event có thể lặp, đến muộn hoặc sai thứ tự.

## 5. Chuyển khoản

Khách chuyển với mã tham chiếu; admin đối soát và xác nhận. Hành động admin phải có
audit log, người duyệt và thời điểm. Không xác nhận từ ảnh chụp nếu chưa thấy giao dịch
thật.

## 6. Stripe code cũ

Code có checkout, portal, cancel/resume, invoice và webhook. Nó phải nằm sau
`BILLING_ENABLED` ở page, API, webhook, email/link và navigation. Stripe test/live
key tuyệt đối không trộn.

Việc code còn tồn tại không có nghĩa doanh nghiệp Việt Nam có thể mở tài khoản Stripe
merchant hợp lệ.

## 7. Kiểm soát quyền

Khi gói hết hiệu lực:

- chỉ role tương ứng bị ảnh hưởng;
- profile tương ứng có thể unpublish theo policy;
- dữ liệu không bị xoá ngay;
- role khác của cùng user vẫn hoạt động;
- session/request mới đọc trạng thái hiện tại;
- email/notification được idempotent.

## 8. Kiểm tra

- flag off chặn page/API/webhook;
- số tiền client bị sửa;
- chữ ký sai;
- webhook lặp/sai thứ tự;
- hai webhook đồng thời;
- intent hết hạn;
- payment thành công nhưng email lỗi;
- gia hạn sớm không mất thời gian đã mua;
- một role hết hạn không ảnh hưởng role khác;
- admin xác nhận chuyển khoản hai lần.

## Việc cần chủ dự án hoàn tất trước khi bật

- pháp lý và tài khoản merchant;
- bảng giá/chính sách hoàn tiền;
- credential production;
- webhook/IPN công khai an toàn;
- đối soát kế toán;
- quy trình hỗ trợ tranh chấp;
- test thật với số tiền nhỏ;
- giám sát và rollback.

Xem `docs/FEATURES.md`, `docs/MVP_SCOPE.md` và
`docs/ops/VAN-HANH-PRODUCTION.md`.
