# Báo cáo lịch sử: rà soát quyền truy cập API trước khi ra mắt

> Đây là kết quả tại thời điểm audit, không phải trạng thái bảo mật hiện tại. Sau
> báo cáo, nhiều phần đã được sửa. Muốn xác nhận hiện trạng phải đọc code và chạy
> test mới.

## Phạm vi

Lần rà soát đã đọc 83 file `src/app/api/**/route.ts`, tương ứng 104 HTTP handler.
Với mỗi handler, người rà soát xác định:

1. Ai được phép gọi?
2. Auth được kiểm tra ở route hay service?
3. Truy vấn có giới hạn theo chủ sở hữu/người tham gia không?
4. Feature flag, chữ ký webhook và secret cron có được kiểm tra không?

Các chốt quyền chính:

- `requireAuth()`: phải đăng nhập.
- `requireRole(userId, role)`: phải có vai trò đang hoạt động.
- `requireActiveSubscription(userId, role)`: vai trò có gói còn dùng được.
- `requirePaidRole(userId)`: có ít nhất một vai trò cung cấp dịch vụ hợp lệ.
- `requireAdmin()`: phải có role ADMIN đang hoạt động.

## Kết quả chính tại thời điểm audit

Phần lớn route có kiểm tra auth và ownership đúng. Route admin gọi
`requireAdmin()`; booking, tin nhắn, portfolio, review, notification và dữ liệu
tài khoản đều giới hạn theo người dùng liên quan.

Hai nhóm rủi ro đáng chú ý được phát hiện.

### 1. Cron có thể fail open

Guard cũ có dạng:

```ts
if (process.env.CRON_SECRET && authHeader !== expected) {
  return unauthorized;
}
```

Nếu `CRON_SECRET` bị thiếu, điều kiện đầu tiên là false và route bỏ qua auth. Ba
route được nêu lúc đó:

- booking reminders;
- expire bookings;
- purge KYC documents.

Cách đúng là **fail closed**: thiếu secret cũng từ chối. Đây đặc biệt quan trọng với
cron xoá dữ liệu.

### 2. API thay đổi role từng cho phép vượt quyền

Audit phát hiện endpoint cập nhật role nhận toàn bộ enum `Role`. Một người dùng có
thể gửi trực tiếp `ADMIN` hoặc `CAMERA_SHOP`, dù UI không hiển thị lựa chọn. Điều
này cho thấy ẩn option ở giao diện không phải kiểm soát bảo mật.

Biện pháp cần có:

- allow-list role người dùng được tự chọn;
- cấm ADMIN ở validation và service;
- kiểm tra `MARKETPLACE_ENABLED` cho CAMERA_SHOP;
- kiểm tra lại profile/search/API sau khi role được tạo;
- test gọi API trực tiếp, không chỉ bấm UI.

## Những vùng đã được xem

| Nhóm API                    | Quy tắc mong đợi                                        |
| --------------------------- | ------------------------------------------------------- |
| `/api/admin/**`             | Admin, thao tác nhạy cảm có audit log                   |
| `/api/auth/**`              | Public có rate limit/anti-enumeration hoặc token hợp lệ |
| availability/blocked dates  | Public chỉ đọc lịch cần thiết; chủ sở hữu mới sửa       |
| bookings                    | Chỉ hai bên liên quan; transition đúng vai trò          |
| cart/orders/products        | Marketplace flag và ownership                           |
| conversations/messages      | Chỉ participant, tôn trọng block                        |
| notifications               | Chỉ notification của chính user                         |
| portfolio/profiles/services | Chủ hồ sơ, gói và verification phù hợp                  |
| reviews/reports             | Reviewer/provider đúng đối tượng                        |
| upload/KYC                  | Auth, purpose và quyền xem ảnh nhạy cảm                 |
| webhook                     | Chữ ký nhà cung cấp và idempotency, không dùng session  |
| cron                        | Bearer secret bắt buộc, fail closed                     |

## Cách tự rà soát route mới

1. Không đăng nhập có gọi được không?
2. User A có đọc/sửa ID của user B không?
3. Đổi ID trong URL/body có vượt ownership không?
4. Gửi role, userId, giá hoặc status giả có được server tin không?
5. Flag tắt nhưng gọi API trực tiếp có chạy không?
6. Request lặp hoặc đồng thời có tạo dữ liệu hai lần không?
7. Response có trả password hash, token, email/điện thoại/địa chỉ không cần thiết?
8. Webhook có xác minh raw body và chữ ký không?
9. Cron thiếu secret có từ chối không?
10. Admin mutation có ghi audit không?

## Kết luận sử dụng báo cáo

Giá trị lớn nhất của audit này là phương pháp: kiểm tra route cùng service và query,
không chỉ tìm `requireAuth()` trong file route. Trạng thái từng endpoint cần được
xác minh lại bằng code hiện tại và test quyền chéo giữa hai tài khoản.
