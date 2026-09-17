# Hàng đợi email và cơ chế gửi lại

## Hiểu nhanh

Mọi email nghiệp vụ của Fgrapher đi qua một bảng trong database gọi là
`email_outbox`. Có thể hình dung đây là “sổ gửi thư kiêm hàng chờ”. Nó giải quyết
hai vấn đề:

1. Resend tạm thời lỗi không được làm thao tác chính như đăng ký hoặc đặt lịch
   trả HTTP 500.
2. Hệ thống cần biết đã cố gửi email nào, thành công hay thất bại.

Outbox ghi cả email thành công ở lần đầu, không chỉ email lỗi.

## Bảng `email_outbox`

| Cột              | Ý nghĩa dễ hiểu                                                          |
| ---------------- | ------------------------------------------------------------------------ |
| `idempotencyKey` | Khoá duy nhất đại diện cho sự kiện gây ra email; dùng để chống gửi trùng |
| `to`             | Địa chỉ nhận                                                             |
| `subject`        | Tiêu đề                                                                  |
| `html`           | Nội dung; có thể bị xoá sau khi không cần gửi lại                        |
| `sensitive`      | Đánh dấu nội dung chứa token hoặc liên kết bí mật                        |
| `status`         | `PENDING`, `SENDING`, `SENT` hoặc `FAILED`                               |
| `attempts`       | Số lần đã thử gửi, tối đa 5                                              |
| `nextAttemptAt`  | Thời điểm sớm nhất được thử lại; rỗng khi đã kết thúc                    |
| `lockedAt`       | Thời điểm một worker nhận xử lý dòng này                                 |
| `providerId`     | Mã email do Resend trả về                                                |
| `lastError`      | Lỗi gần nhất; xoá khi gửi thành công                                     |
| `sentAt`         | Thời điểm Resend chấp nhận email                                         |

Trạng thái có thể hiểu như sau:

```text
PENDING (đang chờ)
  → SENDING (một worker đã nhận)
      → SENT (Resend đã chấp nhận)
      → PENDING (lỗi tạm thời, chờ retry)
      → FAILED (lỗi vĩnh viễn hoặc đã thử đủ 5 lần)
```

## Luồng gửi

### Lần đầu

`sendEmail()` đặt chỗ cho sự kiện rồi thử gửi ngay:

- Resend chấp nhận: ghi `SENT`, `attempts=1`, `providerId`, `sentAt`; caller nhận
  `success: true`.
- Resend từ chối vĩnh viễn, ví dụ email sai hoặc domain gửi chưa xác minh: ghi
  `FAILED`, không thử lại.
- Lỗi tạm thời, ví dụ mạng hoặc Resend gián đoạn: ghi `PENDING`; caller nhận
  `success: false, queued: true`.

`sendEmail()` không ném lỗi làm hỏng thao tác nghiệp vụ. Cách đọc kết quả là:
`success || queued` nghĩa là hệ thống đã nhận trách nhiệm xử lý email.

### Gửi lại bằng cron

Cron gọi `GET /api/cron/email-retry`, nhận từng dòng đến hạn, đổi sang `SENDING`
rồi gửi. Lịch hiện tại trên Vercel Hobby là **một lần mỗi ngày**, nên email chờ
có thể không được thử lại cho tới ngày hôm sau.

## Chống gửi trùng bằng idempotency key

`idempotencyKey` phải đại diện cho **sự kiện**, không phải nội dung email. Ví dụ:

```text
booking-reminder:<bookingId>:<recipientId>
```

Hai email hợp lệ có thể có nội dung giống hệt nhau. Nếu dùng hash nội dung làm
khoá, lần gửi sau sẽ bị nhầm là trùng và mất vĩnh viễn. Khi không truyền khoá,
outbox tạo một khoá ngẫu nhiên mới, nghĩa là luôn gửi như một sự kiện mới.

Khoá được gửi sang Resend qua `Idempotency-Key`. Nếu Resend đã nhận thư nhưng app
chết trước khi cập nhật database, retry trong khoảng 24 giờ vẫn không gửi trùng.

## Email chứa token bí mật

Email xác minh và đặt lại mật khẩu chứa liên kết có token. Caller phải truyền
`sensitive: true` để giảm thời gian token nằm trong outbox:

- gửi thành công ngay: không lưu body;
- kết thúc ở `SENT` hoặc `FAILED`: xoá body trong cùng lần cập nhật;
- cần retry: tạm lưu body vì không có nội dung thì không thể gửi lại.

Rủi ro còn lại là body có thể đọc được khi dòng ở `PENDING` hoặc `SENDING`. Với
cron hằng ngày, token hết hạn mới là giới hạn thực tế: reset mật khẩu sống 1 giờ,
xác minh email sống 24 giờ. Cần bảo vệ backup của bảng này như dữ liệu nhạy cảm.

### Token được lưu ở bảng riêng

- `EmailVerificationToken` chỉ lưu SHA-256.
- `VerificationToken` cho reset mật khẩu lưu dạng `sha256:<hex>` từ 15/09/2026.
- Dòng reset cũ có thể còn token gốc. `completePasswordReset()` chỉ thử dạng cũ
  khi không tìm thấy hash và input là chuỗi hex 64 ký tự. Token cũ được xoá khi
  dùng. Vì TTL chỉ một giờ, sau một giờ deploy không còn link cũ hợp lệ; phần
  fallback đánh dấu `LEGACY` có thể xoá sau giai đoạn chuyển tiếp.

## Chỉ retry liên kết credential mới nhất

Xin liên kết mới sẽ làm token cũ mất hiệu lực. Nếu email cũ còn `PENDING`, cron
không được gửi liên kết chết đó sau email mới.

Quy tắc của hệ thống: với mỗi loại credential và mỗi tài khoản, chỉ email thuộc
lần cấp token mới nhất được chờ retry. Logic nằm trong
`services/credential-email.ts`.

- Khoá có dạng
  `credential:<email-verification|password-reset>:<userId>:<sha256(token)>`.
- Khi cấp token mới, hệ thống ghi token và huỷ các dòng `PENDING` cũ trong cùng
  transaction, dưới Postgres advisory lock theo loại và user.
- Trước khi đưa một lần gửi lỗi trở lại hàng chờ và trước khi cron nhận dòng,
  hệ thống kiểm tra token có còn là token đang sống hay không.
- Dòng bị thay thế chuyển thành `FAILED`, body bị xoá và `lastError` là
  `credential_no_longer_current`.
- Không đụng tới dòng `SENDING`, tài khoản khác, loại credential khác hoặc email
  thường.

Giới hạn: một email đã nằm trên đường truyền khi token mới được cấp vẫn có thể
đến hộp thư một lần, nhưng sẽ không được retry. Dòng tạo trước cơ chế khoá mới
cũng không được nhận diện, nhưng sẽ hết hạn theo token hoặc hết số lần thử.

```sql
-- Các email credential bị huỷ vì có liên kết mới hơn
SELECT "idempotencyKey", "updatedAt" FROM "email_outbox"
WHERE "lastError" = 'credential_no_longer_current'
ORDER BY "updatedAt" DESC LIMIT 20;
```

## An toàn khi nhiều cron chạy cùng lúc

Mỗi dòng được nhận bằng một `updateMany` có điều kiện: chỉ đổi từ `PENDING` sang
`SENDING` nếu vẫn đến hạn. Hai cron cùng thấy một dòng thì chỉ một cron cập nhật
được; cron kia thấy `count=0` và bỏ qua.

Dòng ở `SENDING` quá 10 phút được coi là worker đã chết và trả về `PENDING` ở
lần cron sau. Số lần thử tăng ngay khi nhận dòng, nên một email gây crash liên
tục không thể lặp vô hạn.

## Lịch chờ giữa các lần thử

| Lần thử | Thời gian chờ tối thiểu | Tổng thời gian lý thuyết |
| ------: | ----------------------: | -----------------------: |
|       1 |                gửi ngay |                        0 |
|       2 |                  1 phút |                   1 phút |
|       3 |                  2 phút |                   3 phút |
|       4 |                  4 phút |                   7 phút |
|       5 |                  8 phút |                  15 phút |

Sau lần thứ năm, dòng thành `FAILED` và `nextAttemptAt=NULL`.

Đây chỉ là thời điểm **không được gửi trước**. Email thực tế được thử ở lần cron
đầu tiên sau mốc đó. Với cron năm phút, bảng trên gần đúng. Với cron hằng ngày,
mỗi lần retry cách nhau khoảng một ngày và lỗi kéo dài sẽ mất khoảng bốn ngày để
thành `FAILED`.

## Cấu hình cron hiện tại

```json
{ "path": "/api/cron/email-retry", "schedule": "0 1 * * *" }
```

Lịch này chạy một lần trong khung 01:00–01:59 UTC. Gói Vercel Hobby không cho
cron thường xuyên hơn một lần/ngày và không bảo đảm chính xác tới phút.

Muốn retry nhanh hơn có hai lựa chọn:

1. Nâng lên Vercel Pro và dùng `*/5 * * * *`.
2. Dùng scheduler bên ngoài như GitHub Actions, Upstash QStash, cron-job.org
   hoặc Supabase `pg_cron` gọi endpoint mỗi vài phút.

Scheduler phải gửi header:

```text
Authorization: Bearer <CRON_SECRET>
```

Vercel không gửi `X-Cron-Secret`. Route dùng `requireCronSecret()` và từ chối khi
thiếu secret ngoài môi trường development.

Gọi thủ công:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://<host>/api/cron/email-retry
```

Kết quả gồm số dòng đã xử lý, gửi thành công, thất bại, xếp lại hàng, thu hồi
lock, bỏ qua và bị thay thế (`superseded`).

Resend chỉ nhớ idempotency key khoảng 24 giờ. Với cron hằng ngày, trường hợp hiếm
“Resend đã nhận nhưng database chưa kịp ghi” có thể retry đúng ranh giới 24 giờ;
đây là thêm một lý do nên dùng lịch ngắn hơn khi có điều kiện.

## Câu lệnh kiểm tra vận hành

Trong PostgreSQL, `to` và `status` là từ đặc biệt nên phải đặt trong dấu ngoặc
kép.

```sql
-- Số dòng theo trạng thái
SELECT "status", count(*) FROM "email_outbox" GROUP BY "status";

-- 20 lỗi vĩnh viễn gần nhất
SELECT "id", "to", "subject", "lastError", "attempts", "createdAt"
FROM "email_outbox"
WHERE "status" = 'FAILED'
ORDER BY "updatedAt" DESC LIMIT 20;

-- Dòng SENDING bị kẹt quá 10 phút; bình thường phải rỗng
SELECT "id", "to", "attempts", "lockedAt"
FROM "email_outbox"
WHERE "status" = 'SENDING'
  AND "lockedAt" < now() - interval '10 minutes';

-- Body nhạy cảm còn đọc được; số lượng nên ít và tồn tại ngắn
SELECT "id", "to", "status", "attempts", "createdAt"
FROM "email_outbox"
WHERE "sensitive" AND "html" IS NOT NULL;

-- Email xác minh gần đây
SELECT "status", "attempts", "sentAt", "lastError"
FROM "email_outbox"
WHERE "idempotencyKey" LIKE 'credential:email-verification:%'
ORDER BY "createdAt" DESC LIMIT 20;
```

### Cho một email chạy lại thủ công

Chỉ làm sau khi đã đọc `lastError` và chắc chắn nguyên nhân đã được sửa:

```sql
UPDATE "email_outbox"
SET "status" = 'PENDING', "attempts" = 0, "nextAttemptAt" = now(),
    "lockedAt" = NULL, "lastError" = NULL
WHERE "id" = '<email_id>';
```

Không retry thủ công dòng credential đã bị thay thế; liên kết trong đó không còn
hợp lệ. Hãy yêu cầu người dùng xin liên kết mới.

### Dọn dữ liệu cũ

```sql
DELETE FROM "email_outbox"
WHERE "status" = 'SENT'
  AND "sentAt" < now() - interval '90 days';
```

Hiện chưa có cron dọn tự động. Trước khi bật, cần chốt chính sách lưu trữ và yêu
cầu audit với người phụ trách pháp lý.

## Khi thêm nơi gửi email mới

```ts
const result = await sendEmail({
  to: user.email,
  subject: "…",
  html: someTemplate({/* dữ liệu */}),
  idempotencyKey: emailIdempotencyKey("booking-reminder", booking.id),
});

if (!result.success && !result.queued) {
  // Không có gì sẽ retry; cần ghi log.
}
```

- Chỉ dùng cùng khoá cho cùng một sự kiện.
- Thêm `sensitive: true` nếu body có token hoặc liên kết dùng một lần.
- `enqueueEmail()` bỏ lần gửi ngay và đưa thẳng vào hàng chờ; phù hợp cho tác vụ
  hàng loạt chạy nền.

## Xử lý sự cố thường gặp

**Không email nào gửi được:** kiểm tra `RESEND_API_KEY`. Khi thiếu key, dòng được
giữ ở `PENDING` để gửi sau, không bị đốt thành lỗi vĩnh viễn.

**Dòng nằm ở PENDING nhưng attempts không tăng:** cron không tới endpoint. Kiểm
tra `CRON_SECRET` và Vercel Logs xem có HTTP 401.

**FAILED ngay ở attempts=1:** lỗi vĩnh viễn. Đọc `lastError`; thường là địa chỉ
sai hoặc domain gửi chưa xác minh.

## Phần chưa hoàn thiện

- Chưa có màn hình quản trị outbox; hiện phải dùng SQL.
- Chưa có Resend webhook nên bounce/complaint không quay về database. `SENT` chỉ
  có nghĩa Resend đã nhận, không bảo đảm thư vào inbox.
- Chưa có cron dọn dòng `SENT` cũ.
- Chưa giới hạn tốc độ theo từng người nhận.
- Chưa chạy end-to-end bằng tài khoản Resend thật.

## Từ ngữ cần nhớ

- **Outbox:** bảng lưu việc cần gửi và lịch sử gửi.
- **Retry:** thử lại sau khi lỗi tạm thời.
- **Backoff:** tăng thời gian chờ sau mỗi lần thất bại.
- **Idempotency:** xử lý lặp cùng sự kiện nhưng chỉ tạo một kết quả.
- **Worker:** tiến trình nhận một công việc từ hàng chờ.
- **Terminal state:** trạng thái kết thúc, ở đây là `SENT` hoặc `FAILED`.
- **Advisory lock:** khoá phối hợp do ứng dụng yêu cầu PostgreSQL giữ tạm thời.
