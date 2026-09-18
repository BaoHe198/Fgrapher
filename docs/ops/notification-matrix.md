# Bảng quy tắc gửi thông báo

## Tài liệu này dùng để làm gì?

Fgrapher có hai cách báo cho người dùng: thông báo trong website và email. Mỗi
sự kiện có quy tắc riêng: có gửi email hay không, người dùng có thể tắt hay không,
và tính năng nào phải đang bật.

Nguồn chính xác để máy chạy là `NOTIFICATION_POLICY` trong
`src/lib/notifications.ts`. File này là bản giải thích cho con người. Test
`src/lib/__tests__/notifications.test.ts` bảo đảm mọi `NotificationType` đều có
quy tắc. Khi sửa, phải cập nhật code và tài liệu cùng lúc.

## Hai hàm gửi thông báo

| Hàm                | Thông báo trong web                                    | Email                                                                               | Người dùng có thể tắt?                                         |
| ------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `notify()`         | Có, nếu loại thông báo và tuỳ chọn người nhận cho phép | Có khi policy là `preference`, người nhận bật email và caller truyền nội dung email | Có                                                             |
| `notifyCritical()` | Luôn tạo                                               | Luôn gửi nếu có nội dung email                                                      | Không; dành cho tài khoản, thanh toán, kiểm duyệt hoặc pháp lý |

Nếu feature flag của tính năng đang tắt, cả hai hàm đều không làm gì: không ghi
database và không gửi email. `listNotifications()` cũng lọc lúc đọc, nên thông
báo cũ của một tính năng vừa tắt sẽ không hiện ở chuông, danh sách hoặc số chưa
đọc.

## Chống gửi email trùng (idempotency)

Trước khi gửi, email theo tuỳ chọn được “đặt chỗ” trong bảng `email_outbox` bằng
một khoá duy nhất. Nếu hai tiến trình cùng xử lý một sự kiện, chỉ một tiến trình
tạo được dòng và gửi email. Khoá có dạng:

```text
<phạm-vi>:<mã-sự-kiện>:<mã-người-nhận>
```

Khoá chứa người nhận vì cùng một sự kiện gửi cho hai người vẫn là hai email hợp
lệ.

Riêng `NEW_MESSAGE` có giới hạn: tối đa một email cho cùng người nhận và cùng
hội thoại trong 15 phút. Postgres advisory lock giữ thao tác “kiểm tra email gần
đây” và “tạo email mới” thành một khối không bị hai request chen ngang.

Khoá này cũng được gửi sang Resend qua header `Idempotency-Key`. Nếu Resend đã
nhận email nhưng ứng dụng chết trước khi cập nhật database, lần retry trong vòng
khoảng 24 giờ vẫn không tạo email thứ hai. Dự án chỉ thử tối đa năm lần trong
khoảng thời gian ngắn, nên giới hạn 24 giờ đủ cho tình huống thực tế.

## Ngôn ngữ của thông báo

Email và nội dung trong web hiện dùng ngôn ngữ của request tạo ra sự kiện. Các
tác vụ không có request, như cron, webhook hoặc quét booking hết hạn, dùng tiếng
Việt.

Hệ thống chưa lưu ngôn ngữ ưa thích trên từng `User`. Vì vậy một admin đang dùng
giao diện tiếng Anh có thể khiến email kiểm duyệt gửi bằng tiếng Anh. MVP hiện
ưu tiên tiếng Việt nên đây chưa phải lỗi chặn. Muốn giải quyết dứt điểm cần thêm
cột locale cho user và migration database.

## Bảng quy tắc chi tiết

Giải thích nhanh:

- `core`: tính năng chính của MVP, luôn bật.
- `social`, `marketplace`: đang tắt bằng feature flag.
- `pref`: gửi khi người nhận bật kênh email.
- `critical`: luôn gửi, không phụ thuộc cài đặt.
- `none`: không gửi email, chỉ thông báo trong web.

| Loại (`NotificationType`)                                                             | Nhóm tính năng        | Trong web | Email                                                        | Công tắc của người dùng | Mẫu email                                                                                  | Nơi kích hoạt                         |
| ------------------------------------------------------------------------------------- | --------------------- | --------- | ------------------------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------- |
| `BOOKING_REQUEST`                                                                     | core                  | có        | pref                                                         | `bookingRequest`        | `bookingRequestEmailHtml`                                                                  | `createBooking`                       |
| `BOOKING_CONFIRMED`                                                                   | core                  | có        | pref                                                         | `bookingConfirmed`      | `bookingConfirmedEmailHtml`                                                                | `transitionBooking`                   |
| `BOOKING_DECLINED`                                                                    | core                  | có        | pref                                                         | `bookingCancelled`      | `bookingDeclinedEmailHtml`                                                                 | `transitionBooking`                   |
| `BOOKING_CANCELLED`                                                                   | core                  | có        | pref                                                         | `bookingCancelled`      | `bookingCancelledEmailHtml`, `bookingExpiredEmailHtml`, `bookingRelatedCancelledEmailHtml` | `transitionBooking`, `expireBookings` |
| `BOOKING_REMINDER`                                                                    | core                  | có        | pref                                                         | `bookingReminder`       | `bookingReminderEmailHtml`                                                                 | `sendBookingReminders` (cron)         |
| `AVAILABILITY_REMINDER`                                                               | core                  | có        | pref                                                         | `availabilityReminder`  | `availabilityReminderEmailHtml`                                                            | 07:30 hằng ngày (cron)                |
| `BOOKING_RESCHEDULE_PROPOSED`                                                         | core                  | có        | pref                                                         | `bookingRequest`        | `bookingRescheduleProposedEmailHtml`                                                       | `proposeReschedule`                   |
| `BOOKING_COMPLETED`                                                                   | core                  | có        | pref                                                         | `bookingConfirmed`      | `bookingCompletedEmailHtml`                                                                | `transitionBooking`                   |
| `NEW_MESSAGE`                                                                         | core                  | có        | pref, tối đa 1 email/15 phút cho mỗi hội thoại và người nhận | `newMessage`            | `newMessageEmailHtml`                                                                      | `sendMessage` với tin chữ/ảnh         |
| `NEW_REVIEW`                                                                          | core                  | có        | pref                                                         | `newReview`             | `newReviewEmailHtml`                                                                       | `createReview`                        |
| `REVIEW_RESPONSE`                                                                     | core                  | có        | pref                                                         | `newReview`             | `reviewResponseEmailHtml`                                                                  | `respondToReview`                     |
| `REQUEST_NEW_MATCH`                                                                   | core                  | có        | none; phát cho nhiều provider nên chỉ hiện trong web         | `serviceRequests`       | không có                                                                                   | `notifyMatchingProviders`             |
| `REQUEST_NEW_OFFER`                                                                   | core                  | có        | pref                                                         | `serviceRequests`       | `requestNewOfferEmailHtml`                                                                 | `createOffer`                         |
| `REQUEST_OFFER_ACCEPTED`                                                              | core                  | có        | pref                                                         | `serviceRequests`       | `requestOfferAcceptedEmailHtml`                                                            | `acceptOffer`                         |
| `REQUEST_OFFER_DECLINED`                                                              | core                  | có        | pref                                                         | `serviceRequests`       | `requestOfferDeclinedEmailHtml`                                                            | `acceptOffer`, `declineOffer`         |
| `REQUEST_NO_OFFERS_48H`                                                               | core                  | có        | pref                                                         | `serviceRequests`       | `requestNoOffersEmailHtml`                                                                 | `nudgeUnansweredRequests` (cron)      |
| `SUBSCRIPTION_ACTIVE`                                                                 | core                  | có        | critical                                                     | không có                | `welcomeSubscriptionEmailHtml`, `receiptEmailHtml`                                         | `subscription.ts`, `payments.ts`      |
| `SUBSCRIPTION_EXPIRING`                                                               | core                  | có        | critical                                                     | không có                | `subscriptionCancellingEmailHtml`                                                          | `subscription.ts`, `payments.ts`      |
| `SUBSCRIPTION_CANCELLED`                                                              | core                  | có        | critical                                                     | không có                | `subscriptionEndedEmailHtml`                                                               | `subscription.ts`, `payments.ts`      |
| `PAYMENT_FAILED`                                                                      | core                  | có        | critical                                                     | không có                | `paymentFailedEmailHtml` hoặc mẫu chung                                                    | `subscription.ts`, `payments.ts`      |
| `MEDIA_APPROVED`                                                                      | core                  | có        | critical                                                     | không có                | `mediaApprovedEmailHtml`                                                                   | `admin.ts`                            |
| `MEDIA_REJECTED`                                                                      | core                  | có        | critical                                                     | không có                | `mediaRejectedEmailHtml`                                                                   | `admin.ts`                            |
| `ROLE_CHANGE_APPROVED`                                                                | core                  | có        | critical                                                     | không có                | mẫu chung                                                                                  | `role-change-requests.ts`             |
| `ROLE_CHANGE_REJECTED`                                                                | core                  | có        | critical                                                     | không có                | mẫu chung                                                                                  | `role-change-requests.ts`             |
| `NEW_FOLLOWER`, `NEW_LIKE`, `NEW_COMMENT`                                             | social, đang tắt      | không     | không                                                        | không                   | không                                                                                      | không                                 |
| `NEW_ORDER`, `ORDER_CONFIRMED`, `ORDER_SHIPPED`, `ORDER_DELIVERED`, `ORDER_CANCELLED` | marketplace, đang tắt | không     | không                                                        | không                   | không                                                                                      | không                                 |

## Các công tắc trong trang cài đặt

Danh sách nằm ở `NOTIFICATION_KEYS` trong `src/lib/validations/user.ts` và hiện
tại `/dashboard/settings/notifications`. Mỗi mục có công tắc email và thông báo
trong web:

- `bookingRequest`, `bookingConfirmed`, `bookingCancelled`, `bookingReminder`;
- `newMessage`;
- `serviceRequests`;
- `newReview`;
- `newFollower`, chỉ hiện khi `SOCIAL_FEED_ENABLED` bật;
- `productUpdates` và `tips` được giữ để cấu trúc dữ liệu ổn định, nhưng chưa có
  giao diện và chưa nối với nơi gửi.

## Giới hạn hiện tại

- `notifyCritical()` cũng đặt chỗ trước khi gửi. Mọi nơi gọi email critical phải
  truyền `dedupe`; `buildEmailDedupe` sẽ báo lỗi nếu thiếu mã nhận diện sự kiện.
- Code social và marketplace vẫn còn để dùng lại sau này, nhưng feature flag làm
  chúng dừng trước khi ghi database hoặc gửi email. Khi bật marketplace, các lời
  gọi email trong `orders.ts` phải bổ sung `dedupe`.
- Thông báo `SUBSCRIPTION_EXPIRING` chỉ hiện trong web không dùng reservation của
  email. Caller tự chống trùng bằng thời điểm “đã cảnh báo”.

## Từ ngữ cần nhớ

- **In-app notification:** thông báo hiện trong website.
- **Feature flag:** công tắc bật/tắt tính năng bằng cấu hình.
- **Idempotency:** cùng một sự kiện bị xử lý lại vẫn chỉ tạo một kết quả.
- **Throttle:** giới hạn tần suất trong một khoảng thời gian.
- **Cron:** tác vụ máy chủ tự chạy theo lịch.
