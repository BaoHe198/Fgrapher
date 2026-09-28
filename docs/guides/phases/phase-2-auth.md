# Giai đoạn 2 — Đăng nhập và đăng ký

> Tài liệu lịch sử. Luồng auth hiện tại đã phát triển xa hơn kế hoạch ban đầu.

## Mục tiêu

- Giao diện đăng nhập/đăng ký nhất quán.
- Chọn vai trò và ghi consent.
- Quên/đặt lại mật khẩu.
- Bảo vệ route và session.
- Trạng thái lỗi rõ, không làm lộ tài khoản tồn tại.

## 1. Component form

Input, checkbox và select phải có label, mô tả lỗi, focus ring và trạng thái
disabled/loading. `react-hook-form` quản lý state; Zod kiểm tra dữ liệu.

Validation client giúp trải nghiệm nhanh. Server phải chạy lại cùng quy tắc vì người
dùng có thể gọi API trực tiếp.

## 2. Khung auth

`AuthShell` cung cấp bố cục chung cho login/register/reset:

- vùng form dễ đọc;
- hình/brand chỉ là phần phụ;
- responsive không tạo hai form cùng hoạt động;
- link chuyển chế độ giữ callback an toàn;
- thông báo lỗi không chứa chi tiết nội bộ.

Hiện login và register dùng chung trang/tab; route cũ có thể redirect để giữ link.

## 3. Đăng nhập

Credentials dùng email/mật khẩu; Google dùng OAuth. Server kiểm tra:

- mật khẩu bcrypt;
- email credential đã xác minh;
- tài khoản không bị xoá/khoá;
- callback URL là đường nội bộ an toàn;
- rate limit chống thử mật khẩu.

Không nói “email này tồn tại nhưng mật khẩu sai”; dùng thông báo chung để giảm account
enumeration.

## 4. Đăng ký

Form cần thu thập dữ liệu tối thiểu và consent rõ ràng. Server:

- chuẩn hoá email;
- kiểm tra độ tuổi;
- allow-list role người dùng được chọn;
- cấm ADMIN;
- kiểm tra feature flag cho role bị tắt;
- hash mật khẩu;
- tạo token xác minh và email outbox;
- chịu được hai request đồng thời.

OAuth cũng phải đi qua age gate/consent tương đương trước khi tài khoản được dùng đầy
đủ.

## 5. Xác minh email

Tài khoản credentials chưa xác minh không được đăng nhập hoàn chỉnh. Link:

- token ngẫu nhiên đủ mạnh;
- database lưu hash;
- có TTL;
- chỉ dùng một lần;
- token mới làm token cũ hết hiệu lực;
- consume nguyên tử để hai request không cùng thành công.

Form gửi lại phải có email hoặc nhận an toàn địa chỉ vừa thử đăng nhập; chế độ compact
không được giấu input rồi vô hiệu nút vĩnh viễn.

## 6. Quên và đặt lại mật khẩu

Endpoint forgot luôn phản hồi giống nhau dù email có tồn tại hay không. Reset token có
TTL, one-time use và được lưu hash. Khi đổi mật khẩu:

- kiểm tra policy;
- consume token nguyên tử;
- vô hiệu link cũ;
- cân nhắc thu hồi session;
- gửi thông báo bảo mật.

## 7. Bảo vệ route

`src/proxy.ts` làm redirect sớm, nhưng page/API vẫn phải gọi helper auth:

- `requireAuth()`;
- `requireRole()`;
- `requireActiveSubscription()`;
- `requireAdmin()`.

Proxy không thay thế authorization tại server.

## 8. Kiểm tra

- đăng ký credentials, xác minh rồi đăng nhập;
- Google OAuth mới và tài khoản đã liên kết;
- email chưa xác minh;
- resend với email trống/sai/đúng;
- token hết hạn, dùng lại và hai request đồng thời;
- callback URL bên ngoài;
- role ADMIN/CAMERA_SHOP gửi trực tiếp;
- responsive, keyboard và password manager;
- rate limit và phản hồi chống enumeration.

Chạy lint, typecheck, unit/integration auth và Playwright cho luồng chính.

## Khác với kế hoạch ban đầu

Dự án hiện có email verification, hashed reset token, email outbox, credential email
change, consent/age gate và nhiều chốt race condition. Xem
`docs/ops/email-verification.md` và `docs/ops/email-outbox.md`.
