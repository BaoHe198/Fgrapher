# Sổ tay vận hành Fgrapher

Tài liệu này dành cho người quản trị website. Hướng dẫn deploy/rollback chi tiết nằm
ở `docs/ops/VAN-HANH-PRODUCTION.md`; checklist việc thủ công nằm trong file Excel
ở `docs/ops`.

## 1. Việc kiểm tra hằng ngày

1. Xem Sentry/Vercel Logs có lỗi mới hoặc lỗi tăng đột biến.
2. Kiểm tra uptime và health endpoint.
3. Duyệt hàng chờ media, báo cáo vi phạm và hồ sơ KYC.
4. Xem email outbox có dòng pending/retry/dead bất thường.
5. Kiểm tra payment intent/webhook lỗi nếu cổng thanh toán đang bật.
6. Đọc hộp thư hỗ trợ và phản hồi sự cố người dùng.

Không cố sửa dữ liệu production bằng SQL trước khi hiểu nguyên nhân và có bản sao
lưu.

## 2. Quản lý tài khoản

### Cấp quyền admin

Dùng script được kiểm soát, không cho người dùng chọn ADMIN khi đăng ký:

```bash
pnpm tsx scripts/make-admin.ts <email>
```

Sau đó xác nhận role đã hoạt động và thử `/admin` bằng đúng tài khoản. Mọi thao tác
admin nhạy cảm phải có audit log.

### Xác minh nhà cung cấp

1. Mở `/admin/verifications`.
2. Đối chiếu thông tin và ảnh theo quy trình đã được pháp lý duyệt.
3. Chấp nhận hoặc từ chối kèm lý do đủ rõ.
4. Không tải ảnh giấy tờ về máy cá nhân.
5. Bảo đảm lần xem và quyết định được ghi audit.

### Gán hoặc gia hạn gói thủ công

Khi chưa thu phí tự động, admin có thể cấp gói từ trang chi tiết người dùng. Trước
khi xác nhận:

- chọn đúng user và đúng role;
- ghi lý do, thời hạn và người phê duyệt;
- không sửa trực tiếp bảng nếu UI/service đã có thao tác tương ứng;
- kiểm tra profile/quyền sau khi cập nhật.

### Khoá tài khoản

1. Ghi lại lý do và bằng chứng.
2. Dùng thao tác suspend trong admin.
3. Kiểm tra session/quyền truy cập đã bị vô hiệu theo thiết kế hiện hành.
4. Bảo toàn dữ liệu phục vụ khiếu nại trong thời hạn retention.
5. Gửi thông báo phù hợp nếu chính sách yêu cầu.

### Yêu cầu xoá dữ liệu

1. Xác minh người yêu cầu là chủ tài khoản.
2. Ghi nhận thời điểm, phạm vi và hạn xử lý.
3. Phân biệt dữ liệu xoá ngay, xoá mềm và dữ liệu phải giữ theo nghĩa vụ.
4. Xoá/ẩn dữ liệu ở database và dịch vụ ngoài như Cloudinary.
5. Không giữ bản sao ngoài quy trình.
6. Ghi audit và thông báo kết quả.

## 3. Kiểm duyệt nội dung

Hàng chờ ở `/admin/moderation`. Người duyệt:

1. Xem media và ngữ cảnh hồ sơ/album.
2. Chọn approve/reject theo chính sách.
3. Ghi lý do khi từ chối hoặc xử lý tài khoản.
4. Ưu tiên nội dung máy đánh dấu nhưng không coi kết quả máy là phán quyết.
5. Escalate tình huống pháp lý hoặc an toàn nghiêm trọng cho người chịu trách nhiệm.

Máy quét chỉ hỗ trợ sàng lọc. Ảnh KYC không đi qua luồng này. Chi tiết ở
`docs/ops/content-moderation.md`.

## 4. Email và thông báo

Email được ghi vào outbox rồi gửi. Khi Resend lỗi tạm thời, cron thử lại.

Khi người dùng báo không nhận mail:

1. Xác nhận đúng địa chỉ và loại email.
2. Tìm dòng outbox theo recipient/idempotency key.
3. Xem `status`, `attemptCount`, `lastError`, `nextRetryAt`.
4. Kiểm tra domain Resend, SPF/DKIM/DMARC và thư rác.
5. Với email token, xác nhận link còn mới; không chạy lại email credential cũ.
6. Chỉ cho retry thủ công sau khi nguyên nhân đã được sửa.

Không gửi token/reset link qua chat hỗ trợ. Xem `docs/ops/email-outbox.md` và
`docs/ops/email-verification.md`.

### Nhắc provider cập nhật lịch bận

Cron `GET /api/cron/availability-reminders` chạy lúc 00:30 UTC, tức 07:30 giờ
Việt Nam. Cron chỉ nhắc tài khoản provider đang hoạt động, đã xác minh, có hồ sơ
công khai và đang bật nhận lịch. Thông báo mở thẳng `/dashboard/calendar` để họ
kiểm tra hôm nay và 7 ngày tới.

Mỗi provider chỉ có một thông báo và một email cho mỗi ngày. Nếu Vercel chạy lại
cron, mã định danh theo ngày ngăn gửi trùng. Provider có thể tắt riêng email hoặc
thông báo trong web ở phần Cài đặt thông báo.

Khi kiểm tra thủ công trên production, luôn gửi header
`Authorization: Bearer <CRON_SECRET>`. Không gọi route này không có secret; local
development cho phép bỏ secret để tiện thử và có thể tạo thông báo thật trong
database dev.

## 5. Thanh toán

Phần này chỉ áp dụng cho phương thức đã được bật.

### Kiểm tra một giao dịch

1. Tìm payment intent theo mã tham chiếu nội bộ.
2. Đối chiếu số tiền, user, role, phương thức và thời hạn.
3. Xem webhook/IPN đã được xác minh và xử lý chưa.
4. Kiểm tra event ID có bị nhận lặp.
5. Đối chiếu trạng thái bên cổng và database.
6. Không cấp gói chỉ dựa vào ảnh chụp màn hình của khách.

### Chuyển khoản thủ công

- Chỉ admin có quyền mới xác nhận.
- Dùng đúng mã tham chiếu và số tiền.
- Một intent chỉ được cấp quyền một lần.
- Ghi người xác nhận, thời điểm và bằng chứng đối soát.
- Nếu sai, dùng luồng điều chỉnh có audit thay vì sửa âm thầm.

### Hoàn tiền

Xác nhận chính sách, số tiền, trạng thái đơn/gói và cổng nhận tiền. Ghi mã giao dịch
hoàn tiền. Webhook đến muộn không được đưa quyền về trạng thái sai.

## 6. Database và sao lưu

### Việc định kỳ

- Xác nhận backup production vẫn chạy.
- Mỗi quý thử restore vào project thử.
- Theo dõi dung lượng, kết nối, query chậm và index.
- Kiểm tra cron retention có xoá đúng dữ liệu hết hạn.

Backup chưa từng restore thử chưa thể xem là kế hoạch khôi phục hoàn chỉnh.

### Trước migration production

1. Đọc SQL migration.
2. Kiểm tra trên dev/Preview.
3. Xác nhận backup/PITR.
4. Ước lượng lock và thời gian chạy.
5. Chuẩn bị rollback.
6. Chạy qua pipeline có duyệt.

Không dùng `prisma migrate dev`, `db push` hoặc `reset` với production. Xem
`docs/MIGRATIONS.md`.

## 7. Xử lý sự cố

### Mức độ

| Mức | Ví dụ                                                  | Hành động                                              |
| --- | ------------------------------------------------------ | ------------------------------------------------------ |
| P0  | Rò dữ liệu, mất dữ liệu, website chính không dùng được | Ngăn tác hại/rollback ngay, gọi người chịu trách nhiệm |
| P1  | Đăng nhập, booking hoặc thanh toán hỏng diện rộng      | Điều tra ngay và cập nhật thường xuyên                 |
| P2  | Một tính năng phụ lỗi, có đường vòng                   | Lập issue và sửa theo ưu tiên                          |
| P3  | Lỗi hiển thị nhỏ                                       | Gom vào đợt bảo trì                                    |

### Quy trình

1. Ghi thời điểm, URL, user bị ảnh hưởng và cách tái hiện.
2. Xác định phạm vi: một người, một role hay toàn hệ thống.
3. Xem deploy gần nhất, log, metric và dịch vụ ngoài.
4. Nếu bản mới gây lỗi nghiêm trọng, rollback code trước.
5. Bảo toàn bằng chứng; không log thêm dữ liệu nhạy cảm.
6. Sửa ở nhánh, thêm kiểm tra bảo vệ và deploy theo quy trình.
7. Theo dõi sau sửa và ghi lại nguyên nhân gốc.

## 8. Giám sát

Production tối thiểu cần:

- health check và uptime monitor;
- Sentry nhận exception;
- Vercel Logs;
- cảnh báo database/dung lượng;
- cảnh báo email outbox và cron thất bại;
- cảnh báo webhook/thanh toán lỗi khi feature được bật.

Mỗi cảnh báo phải có người nhận, mức độ và hành động đầu tiên. Cảnh báo không ai
chịu trách nhiệm chỉ tạo thêm tiếng ồn.

## 9. Hỗ trợ người dùng

Khi nhận phản ánh, hỏi:

1. Người dùng làm gì và mong đợi gì?
2. Điều gì thực tế xảy ra?
3. Thời điểm, URL, thiết bị/trình duyệt?
4. Có mã lỗi hoặc ảnh chụp đã che dữ liệu nhạy cảm không?
5. Lỗi có lặp lại không?

Không yêu cầu người dùng gửi mật khẩu, token, cookie, ảnh CCCD qua kênh hỗ trợ
thường. Khi cần tra log, dùng ID nội bộ và khoảng thời gian.

## 10. Lịch bảo trì

### Hằng tuần

- dọn hàng chờ kiểm duyệt/KYC;
- xem lỗi và cron;
- kiểm tra email retry/dead;
- rà thanh toán chưa đối soát nếu đang bật.

### Hằng tháng

- chạy audit dependency;
- kiểm tra backup và dung lượng;
- rà tài khoản admin/quyền truy cập;
- xem chỉ số hiệu năng và chi phí dịch vụ ngoài;
- cập nhật tài liệu nếu quy trình đã đổi.

### Hằng quý

- thử restore;
- diễn tập một tình huống rollback/sự cố;
- rà retention, consent và quyền xem dữ liệu;
- xoá secret/tài khoản không còn dùng.

Checklist thao tác chi tiết nằm trong
`docs/ops/Fgrapher-checklist-viec-thu-cong.xlsx`.
