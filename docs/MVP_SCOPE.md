# Phạm vi MVP của Fgrapher

Tài liệu này phân biệt phần đang phục vụ MVP, phần có code nhưng đang tắt và phần chưa
xây. Nó giúp tránh vô tình quảng bá hoặc vận hành một tính năng chưa sẵn sàng.

Nguồn kiểm tra:

- `src/lib/env.ts` và `src/lib/features.ts`: feature flag;
- `docs/FEATURES.md`: hành vi hiện tại;
- code/test: nguồn quyết định cuối cùng.

## 1. Mục tiêu MVP

MVP tập trung vào việc giúp khách tìm và làm việc với người cung cấp dịch vụ sáng tạo:

1. đăng ký và xác minh tài khoản;
2. tạo vai trò/hồ sơ;
3. KYC và kiểm duyệt media;
4. tìm kiếm nhà cung cấp;
5. đặt lịch hoặc đăng yêu cầu dịch vụ;
6. nhắn tin;
7. đánh giá sau booking;
8. admin vận hành nền tảng.

## 2. Vai trò

| Vai trò         | Trong MVP? | Ghi chú                                   |
| --------------- | ---------- | ----------------------------------------- |
| `CUSTOMER`      | Có         | Tìm, booking, đăng yêu cầu                |
| `PHOTOGRAPHER`  | Có         | Hồ sơ và dịch vụ                          |
| `VIDEOGRAPHER`  | Có         | Hồ sơ và dịch vụ                          |
| `MAKEUP_ARTIST` | Có         | Hồ sơ và dịch vụ                          |
| `MODEL`         | Có         | Có yêu cầu tuổi/KYC/an toàn riêng         |
| `STUDIO`        | Có         | Hồ sơ và dịch vụ                          |
| `ADMIN`         | Có         | Chỉ cấp thủ công, không phải role tự chọn |
| `CAMERA_SHOP`   | Tắt        | Thuộc marketplace                         |

Role vẫn có thể tồn tại trong enum/database khi feature tắt để giữ dữ liệu và tránh
migration phá huỷ. Server phải chặn tạo mới và bề mặt công khai tương ứng.

## 3. Phần đang nằm trong MVP

- Auth: credentials, Google OAuth, email verification, password reset.
- Age gate, consent và tài khoản nhiều vai trò.
- Hồ sơ công khai, location/vùng phục vụ và publish gate.
- Album/portfolio, Cloudinary, moderation và thùng rác.
- Browse/search và saved profile.
- Dịch vụ, availability, blocked date và booking.
- Service request, matching và offer.
- Messaging bằng polling, block/report.
- Review gắn với booking.
- Notification trong app và email outbox.
- KYC/verification, retention và audit.
- Admin cho user, report, moderation, verification, compliance.
- Cache có kiểm soát cho một số dữ liệu công khai.
- Test, CI, deploy và vận hành production.

## 4. Marketplace đang tắt

`MARKETPLACE_ENABLED=false` mặc định.

Phần giữ lại trong code/schema:

- `Product`, `ProductImage`, `CartItem`, `Order`, `OrderItem`;
- service/API sản phẩm, cart, order;
- trang `/shop`, `/cart`, `/checkout`;
- dashboard listings/orders;
- role CAMERA_SHOP.

Khi tắt:

- page và API bị chặn;
- role không được tự tạo;
- browse/pricing/navigation không hiển thị;
- sitemap/count/notification không đưa dữ liệu marketplace vào.

Không bật trước khi có thanh toán/payout, hoàn tiền, giao nhận, tranh chấp, điều
khoản và quy trình vận hành shop.

## 5. Social feed đang tắt

`SOCIAL_FEED_ENABLED=false` mặc định.

Schema/code có thể còn `Post`, `PostMedia`, `Like`, `Comment`, `Follow`. Khi
tắt, nút follow và API liên quan không hoạt động; dữ liệu cũ không đi vào UI/count.

Saved profile là tính năng riêng, không được vô tình tắt cùng follow.

## 6. Stripe billing đang tắt

`BILLING_ENABLED=false` mặc định vì điều kiện merchant tại Việt Nam. Code Stripe
được giữ sau flag:

- checkout/portal/cancel/resume/invoices;
- webhook Stripe;
- price/credential env;
- UI billing Stripe.

Không dùng Stripe code đang tồn tại như bằng chứng dịch vụ có thể thu tiền hợp pháp
tại Việt Nam.

## 7. Cấp gói miễn phí

`FREE_ROLE_GRANT_ENABLED` là policy độc lập. Khi bật, role mới có thể nhận gói miễn
phí thay vì bắt thanh toán. Tách flag này khỏi `BILLING_ENABLED` để khi bổ sung cổng
Việt Nam, việc Stripe tắt không vô tình tiếp tục cấp miễn phí.

## 8. Thanh toán Việt Nam đang tắt

Các flag độc lập:

- `MOMO_ENABLED`;
- `ZALOPAY_ENABLED`;
- `BANK_TRANSFER_ENABLED`.

Code gồm payment intent, API/webhook, trang admin đối soát, cron hết hạn/nhắc gia hạn
và field provider transaction. Mặc định không thu tiền.

Chỉ bật sau khi có merchant credential thật, kiểm tra chữ ký, đối soát, hoàn tiền,
support và test production có kiểm soát.

## 9. Kiểm duyệt tự động đang tắt

`CONTENT_MODERATION_ENABLED=false` mặc định. Hàng chờ người duyệt vẫn hoạt động.
Khi bật, máy quét chỉ đánh dấu/ưu tiên; con người quyết định. Cần consent/căn cứ rõ
trước khi gửi ảnh sang dịch vụ AI ngoài. Không gửi KYC.

## 10. Xác minh điện thoại

`PHONE_VERIFICATION_REQUIRED` điều khiển gate SMS trước khi đăng service request.
Twilio có chi phí; endpoint phải chống spam/SMS toll fraud. Dev bypass không hoạt
động ở production.

## 11. Phần chưa xây hoặc chưa hoàn thiện vận hành

- giao file ảnh/video cuối cùng cho khách qua nền tảng;
- realtime WebSocket quy mô lớn;
- payout tự động cho shop;
- quy trình pháp lý đã được luật sư xác nhận hoàn toàn;
- một số cấu hình production như Sentry, uptime, email domain hoặc backup tuỳ trạng
  thái tài khoản thật.

Checklist thủ công là nguồn theo dõi các việc vận hành còn lại.

## 12. Quy tắc khi thêm tính năng

1. Xác định có thuộc MVP không.
2. Nếu chưa sẵn sàng, tạo flag server-side.
3. Chặn page, API, role, search/count, sitemap và notification.
4. Không quảng bá trong landing/metadata/email.
5. Viết điều kiện bật: pháp lý, credential, test và vận hành.
6. Cập nhật file này cùng `docs/FEATURES.md`.

## 13. Những điều không được suy ra

- Có model/table không có nghĩa tính năng đang bật.
- Có nút ẩn không có nghĩa API đã an toàn.
- Code build được không có nghĩa quy trình kinh doanh đã sẵn sàng.
- Sandbox thành công không chứng minh production/merchant hợp lệ.
- Feature flag tắt không tự động xử lý dữ liệu cũ nếu query không lọc.

Xem `docs/ops/Fgrapher-checklist-viec-thu-cong.xlsx` để theo dõi việc ngoài code.
