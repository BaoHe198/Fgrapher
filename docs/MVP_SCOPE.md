# MVP Scope

Kết quả đọc dự án cho `docs/guides/fgrapher-danh-gia-va-prompt-sua-doi.md`
Prompt B0. Liệt kê file nào thuộc MVP, file nào sẽ bị ẩn sau feature flag
(Prompt B1/B6), file nào là code chết. Không xóa gì ở đây — chỉ inventory.

## Tóm tắt kiến trúc hiện tại (Việc 1 của B0)

Next.js 16 App Router, tách tầng rõ ràng: route handler (`src/app/api/*`)
chỉ validate + gọi service, business logic nằm ở `src/services/*` (13
file, một domain một file), Zod schema ở `src/lib/validations/*`. Auth qua
NextAuth v5, session JWT, role/subscription check qua
`src/lib/auth-helpers.ts`. Đa vai trò trên một tài khoản qua bảng nối
`UserRole` (cờ `active`, `@@unique([userId, role])`), mỗi vai trò trả phí
có `Profile` riêng (`@@unique([userId, role])`). Tìm kiếm qua
`services/search.ts`, không có cache layer. i18n qua next-intl, cookie-based
(không có segment `[locale]`). Thanh toán qua Stripe (subscription +
marketplace), webhook 5 event. Không có real-time thật — polling
(4s/15s/30s). Đã có age-gate (`lib/age-gate.ts`) và verification queue
(`UserRole.verificationStatus`) nhưng chỉ áp dụng cho `MODEL`.

**Business logic lọt ra ngoài tầng service** — không tìm thấy trường hợp
đáng kể nào; quy ước tách tầng được giữ nhất quán trong toàn bộ 68 route.

## Vai trò

| Vai trò                                                                                 | MVP?                                                                                                                               |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `CUSTOMER`, `PHOTOGRAPHER`, `VIDEOGRAPHER`, `MAKEUP_ARTIST`, `MODEL`, `STUDIO`, `ADMIN` | ✅ Trong phạm vi                                                                                                                   |
| `CAMERA_SHOP`                                                                           | ⏸️ Ẩn sau `MARKETPLACE_ENABLED` — giữ trong enum `Role` (không xóa, tránh vỡ dữ liệu), ẩn khỏi UI chọn vai trò và bộ lọc `/browse` |

## MVP — giữ nguyên, tiếp tục phát triển

- Auth: `src/lib/auth.ts`, `(auth)/login/*`, `/api/auth/*`
- Hồ sơ + portfolio: `services/public-profile.ts`, `(public)/profile/*`,
  `(dashboard)/dashboard/settings/profile/*`
- Tìm kiếm/browse: `services/search.ts`, `(public)/browse/*` — sẽ sửa ở B4
  để thêm lọc tỉnh
- Đặt lịch: `services/bookings.ts`, `services/availability.ts`,
  `(public)/booking/*`, `(dashboard)/dashboard/bookings/*`,
  `(dashboard)/dashboard/calendar/*` — sẽ mở rộng ở B7
- Nhắn tin: `services/messaging.ts`, `components/chat/*`
- Đánh giá: `services/reviews.ts`
- Thông báo: `services/notification.ts` — **lưu ý**: `NotificationType`
  có sẵn các giá trị thuộc marketplace (`NEW_ORDER`, `ORDER_CONFIRMED`,
  `ORDER_SHIPPED`, `ORDER_DELIVERED`, `ORDER_CANCELLED`) và mạng xã hội
  (`NEW_FOLLOWER`, `NEW_LIKE`, `NEW_COMMENT`) — B6 cần đảm bảo các loại
  này không phát sinh mới khi cờ tắt, dù enum vẫn giữ nguyên
- Admin: `services/admin.ts`, `(admin)/admin/*`
- Model role safety đã có: `lib/age-gate.ts` (B3 sẽ mở rộng ra mọi vai
  trò), `UserRole.verificationStatus` (B3 sẽ mở rộng), `/guidelines`,
  báo cáo ưu tiên cao trong `services/admin.ts`

## Sẽ ẩn sau `MARKETPLACE_ENABLED` (Prompt B6)

- Model: `Product`, `ProductImage`, `Order`, `OrderItem`, `CartItem`,
  `DepositStatus`
- Service: `services/marketplace.ts`, `services/orders.ts`
- Trang: `/shop`, `/shop/[productId]`, `/cart`, `/checkout`,
  `/checkout/success`, `(dashboard)/dashboard/listings/*`,
  `(dashboard)/dashboard/orders/*`, `(dashboard)/dashboard/shop-orders`
- API: `/api/products/*`, `/api/shop-products/*`, `/api/cart/*`,
  `/api/orders/*`
- Vai trò `CAMERA_SHOP` (giữ trong enum, ẩn khỏi UI)
- 12 biến `STRIPE_PRICE_CAMERA_SHOP_*`/role khác liên quan checkout —
  chồng chéo với `BILLING_ENABLED` bên dưới, B1 và B6 cần phối hợp không
  ẩn hai lần hoặc xung đột

## Sẽ ẩn sau `SOCIAL_FEED_ENABLED` (Prompt B6)

- Model: `Post`, `PostMedia`, `Like`, `Comment`, `Follow`
- **Lưu ý quan trọng cho B6**: `Follow` **không** phải tính năng tách
  biệt như `Post` — nút Follow nằm ngay trong `ProfileActions`
  (`components/profile/profile-actions.tsx`), hiển thị trên **mọi** trang
  hồ sơ, không phải một trang feed riêng. Ẩn `Follow` nghĩa là phải sửa
  `ProfileActions` để bỏ nút đó đi (hoặc ẩn có điều kiện theo cờ), không
  chỉ chặn route — không có route `/post/*` hay `/feed` nào tồn tại để
  chặn theo kiểu `notFound()` như marketplace.
- Không tìm thấy trang feed (`/feed`, `/post/*`) nào đã được xây — có vẻ
  các model này được tạo sẵn trong schema từ giai đoạn đầu nhưng UI feed
  chưa từng triển khai. Xác nhận lại ở B6 bằng cách grep UI trước khi giả
  định "ẩn" — có thể chỉ cần ẩn `Follow` trong `ProfileActions`.

## Sẽ ẩn sau `BILLING_ENABLED` (Prompt B1)

- `lib/stripe.ts`, `services/subscription.ts` (phần gọi Stripe — model
  `Subscription`/`SubscriptionStatus` vẫn dùng cho gán gói thủ công, giữ
  nguyên không ẩn)
- API: `/api/stripe/*` (6 route), `/api/webhooks/stripe`
- Trang: `/onboarding/billing`, `(dashboard)/dashboard/settings/billing`
- 12 biến `STRIPE_PRICE_<ROLE>_*`, `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- Model `Payment`, `WebhookEvent` — giữ nguyên trong schema, không còn
  đường ghi mới khi cờ tắt

## Chưa xây (không phải code chết, chỉ là chưa có)

- Giao ảnh/video cho khách qua nền tảng — không tìm thấy model hay route
  nào cho việc này trong codebase hiện tại. Không phải "ẩn", là "chưa
  làm" — nằm ngoài phạm vi MVP theo tài liệu nguồn.
- Toàn bộ tầng tuân thủ pháp luật (Consent, AuditLog, DataRequest,
  Province/Ward, moderation status trên `ProfileMedia`) — sẽ xây ở
  B2/B3/B4/B5, chưa tồn tại tính tới thời điểm viết tài liệu này.
