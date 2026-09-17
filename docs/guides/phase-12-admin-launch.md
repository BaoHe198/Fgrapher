# Giai đoạn 12 — Quản trị và ra mắt

> Tài liệu lịch sử. Production đã được triển khai sau kế hoạch này; dùng tài liệu
> vận hành hiện hành trong `docs/ops`.

## Mục tiêu

- Quyền ADMIN và khu quản trị.
- Quản lý user, verification, moderation và thanh toán.
- Checklist production.
- Giám sát sau ra mắt.

## 1. Quyền admin

ADMIN:

- không xuất hiện trong form đăng ký/đổi role;
- chỉ được cấp bằng script/quy trình có kiểm soát;
- route/page gọi `requireAdmin()`;
- thao tác nhạy cảm ghi `AdminAction`;
- không dùng một admin chung cho nhiều người.

Endpoint tự phục vụ phải allow-list role để không nhận ADMIN khi gọi trực tiếp.

## 2. Dashboard admin

Số liệu tổng quan chỉ nên phục vụ quyết định vận hành:

- user/provider mới;
- profile/verification/moderation pending;
- booking/request;
- email/payment/cron lỗi;
- report chưa xử lý.

Query có giới hạn, không đếm feature đang tắt và không biến lỗi query thành số 0.

## 3. Quản lý người dùng

Admin có thể xem chi tiết cần thiết, suspend, xử lý role/gói và yêu cầu dữ liệu. Không
trả `passwordHash`, token hoặc toàn bộ object User.

Thao tác:

- xác nhận đúng tài khoản;
- yêu cầu lý do;
- ghi audit;
- idempotent khi bấm lại;
- không làm ảnh hưởng role khác ngoài phạm vi.

## 4. Verification/KYC

- Ảnh dùng authenticated storage.
- Danh sách không trả URL ảnh.
- Route chuyên dụng tạo signed URL ngắn.
- Mỗi lần xem ghi audit với admin/thời điểm.
- Approve/reject có lý do.
- Cron xoá theo retention.
- Không tải giấy tờ về thiết bị cá nhân.

Luật sư cần xác nhận dữ liệu, nơi lưu và thời hạn.

## 5. Moderation và report

Admin duyệt media pending/auto-flagged và report. Công cụ máy chỉ ưu tiên; con người
quyết định. Bulk action phải tránh chọn nhầm, có confirm phù hợp và ghi audit.

## 6. Quản trị tài chính

Khi chưa thu phí, admin gán gói thủ công. Khi phương thức thanh toán bật, admin có
thêm đối soát intent/chuyển khoản/refund. Không xác nhận từ ảnh chụp mà chưa có bằng
chứng giao dịch.

## 7. Chuẩn bị production

- Vercel Production dùng secret riêng.
- Supabase production tách dev.
- Migration được duyệt và backup/PITR sẵn sàng.
- Domain, HTTPS, OAuth callback.
- Resend domain với SPF/DKIM/DMARC.
- Cloudinary vùng lưu/lifecycle.
- Sentry, uptime, alert owner.
- Cron secret và lịch thực tế.
- Tài khoản admin thật, không dùng seed.

## 8. Checklist thủ công trước mở

1. Đăng ký credentials, xác minh email, đăng nhập.
2. Google OAuth và hoàn tất age/consent.
3. Tạo role/profile, KYC, upload và moderation.
4. Publish/search/xem public.
5. Booking, reschedule, cancel, reminder.
6. Service request/offer.
7. Messaging, block/report.
8. Review sau booking.
9. Email thật tới inbox.
10. Mobile/dark mode/keyboard.
11. Feature flag off không lọt qua API.
12. Backup/rollback và cảnh báo.

Checklist chi tiết nằm trong
`docs/ops/Fgrapher-checklist-viec-thu-cong.xlsx`.

## 9. Sau ra mắt

- theo dõi log/Sentry/uptime;
- phản hồi P0/P1 theo runbook;
- kiểm tra moderation/KYC/support mỗi ngày;
- xem email outbox và cron;
- theo dõi chi phí database/media/email/SMS;
- thu phản hồi người dùng;
- không bật feature lớn nếu chưa có vận hành.

## 10. Khi có sự cố

1. Xác định phạm vi và deploy gần nhất.
2. Nếu nghiêm trọng do code mới, rollback.
3. Bảo vệ dữ liệu và giữ bằng chứng.
4. Sửa qua nhánh/test/Preview.
5. Deploy, theo dõi và ghi nguyên nhân gốc.

Xem `docs/ops/VAN-HANH-PRODUCTION.md` và `docs/OPERATIONS.md`.
