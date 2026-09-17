# Xác minh email cho tài khoản đăng ký bằng mật khẩu

## Hiểu nhanh

Người đăng ký bằng email và mật khẩu phải bấm liên kết trong email để chứng minh
họ sở hữu địa chỉ đó, rồi mới được đăng nhập. Người đăng ký bằng Google OAuth
không cần bước này vì Google đã xác minh email; Prisma adapter sẽ điền
`users.emailVerified` khi liên kết tài khoản.

## Chốt chặn khi đăng nhập

Logic nằm trong `authorize()` tại `src/lib/auth.ts`:

```text
Mật khẩu đúng?
  ├─ Không → trả về “sai email hoặc mật khẩu”
  └─ Có → emailVerified đã có giá trị?
           ├─ Không → báo email chưa xác minh
           └─ Có → cho đăng nhập
```

Hệ thống chỉ báo “email chưa xác minh” **sau khi mật khẩu đã đúng**. Vì vậy người
lạ không thể dùng thông báo này để dò xem một địa chỉ có tài khoản hay không.

Callback `signIn` kiểm tra `emailVerified` thêm lần nữa. Đây là “defence in
depth”: nếu sau này có code đăng nhập mới bỏ qua `authorize()`, lớp thứ hai vẫn
chặn tài khoản chưa xác minh.

## Luồng từ đăng ký đến xác minh

1. `POST /api/auth/register` tạo user nhưng chưa điền `emailVerified`, lưu bằng
   chứng đồng ý và cấp role miễn phí.
2. API gọi `sendVerificationEmail()` và trả
   `{ data: { verificationRequired: true } }`.
3. Giao diện yêu cầu người dùng kiểm tra hộp thư thay vì tự đăng nhập.
4. Người dùng mở `/verify-email?token=…`; trang gọi
   `POST /api/auth/verify-email`.
5. `verifyEmailToken()` tiêu thụ token và điền `emailVerified`.
6. Nếu cần, `POST /api/auth/resend-verification` tạo liên kết mới.

Gửi email lỗi không làm đăng ký thất bại. `sendVerificationEmail()` tự xử lý lỗi
và outbox sẽ retry. Tài khoản đã tồn tại, người dùng luôn có thể xin gửi lại.

## Token xác minh được bảo vệ thế nào?

| Thuộc tính         | Giá trị                                                |
| ------------------ | ------------------------------------------------------ |
| Độ dài             | 32 byte ngẫu nhiên, biểu diễn thành chuỗi hex 256 bit  |
| Lưu trong database | Chỉ lưu SHA-256 tại `tokenHash`, không lưu token gốc   |
| Thời hạn           | 24 giờ                                                 |
| Số token mỗi user  | Tối đa một, nhờ `UNIQUE(userId)`                       |
| Số lần dùng        | Một lần; thao tác xoá token chính là thao tác tiêu thụ |

Token gốc chỉ có trong URL gửi cho người dùng. Nếu database token bị đọc trộm,
kẻ xấu chỉ thấy hash và không thể dùng hash làm liên kết xác minh.

### Vì sao phải “xoá để dùng”?

Không nên đọc token trước rồi mới xoá ở bước sau. Nếu hai request đến cùng lúc,
cả hai có thể cùng đọc thấy token còn hợp lệ. Fgrapher dùng `deleteMany` trong
transaction làm điểm phân xử: request đầu xoá được một dòng; request sau chờ
request đầu commit rồi không xoá được dòng nào. Chỉ request xoá được đúng một
dòng mới xác minh user.

Mail client có thể tự mở trước liên kết để kiểm tra an toàn, và người dùng có thể
bấm đúp, nên xử lý đồng thời không phải trường hợp lý thuyết.

Nếu một request thua cuộc đua, hệ thống đọc lại trạng thái user. Nó chỉ trả
`already_verified` nếu user thật sự đã được xác minh; nếu token biến mất vì admin
xoá hoặc tài khoản bị xoá, kết quả là `invalid`.

### Vì sao chỉ có một token mỗi người?

Mỗi lần gửi lại sẽ làm liên kết cũ mất hiệu lực. Database bảo đảm điều này bằng
`UNIQUE(userId)` và upsert dưới lock; đây không chỉ là kiểm tra ở giao diện.

Đổi lại, nếu người dùng xin nhiều email rồi bấm email đầu tiên, họ sẽ thấy “liên
kết không hợp lệ”. Dự án giảm tình huống đó bằng cách:

- khoá nút gửi lại khi request đang chạy và sau khi gửi thành công;
- giới hạn 3 lần mỗi địa chỉ/giờ và 5 lần mỗi IP;
- trang lỗi có nút xin liên kết mới.

Cho nhiều token cũ cùng sống sẽ tiện hơn một chút nhưng tăng thời gian một liên
kết bị lộ còn sử dụng được, nên dự án chọn chỉ giữ token mới nhất.

## Sau khi xác minh, người dùng đi đâu?

Trước đây trang đăng ký tự tạo đường dẫn thanh toán và đưa cho `signIn()`. Khi
thêm xác minh email, đăng ký không còn tự đăng nhập nên đường dẫn đó bị mất. Giải
pháp hiện tại là **tính lại đích đến từ database**, không tin một URL do người
dùng truyền vào:

- API xác minh đọc các provider role chưa kích hoạt của tài khoản và trả về
  đường dẫn `next` phù hợp.
- Trang thành công dẫn tới `/login?callbackUrl=<next>`.
- Cả server và client đều kiểm tra bằng `isSafeInternalPath()` để URL bên ngoài
  không thể trở thành nơi chuyển hướng.

Chu kỳ thanh toán `month` hoặc `year` là lựa chọn giao diện chưa lưu trong
database nên được mang theo liên kết email. Giá trị lạ được đổi về tháng thay vì
làm xác minh thất bại. Thông tin này được giữ qua đăng ký, trang kiểm tra hộp thư,
gửi lại và prompt ở trang đăng nhập.

Khi `BILLING_ENABLED=false`, đích đến luôn là `/dashboard` vì role đã được cấp
gói miễn phí. Cơ chế trên sẽ có tác dụng khi billing được bật.

## Chống dò tài khoản qua API

`POST /api/auth/resend-verification` luôn trả cùng HTTP 200 và cùng thông báo cho
mọi trường hợp: email không tồn tại, đã xác minh, bị đình chỉ, đã xoá mềm, chỉ dùng
OAuth hoặc vượt rate limit. Người gọi không thể phân biệt địa chỉ có tài khoản
hay không.

Khoá rate limit được chuyển về chữ thường. Việc tìm user thử khớp chính xác trước,
sau đó mới tìm không phân biệt hoa thường vì hệ thống cũ chưa chuẩn hoá toàn bộ
email. Sửa triệt để cần migration và quyết định xử lý dữ liệu hiện có.

## Kiểm tra vận hành bằng SQL

```sql
-- Số tài khoản dùng mật khẩu nhưng chưa xác minh
SELECT count(*) FROM "users"
WHERE "emailVerified" IS NULL AND "passwordHash" IS NOT NULL
  AND "deletedAt" IS NULL;

-- Các token còn tồn tại, token cũ nhất trước
SELECT "userId", "createdAt", "expiresAt"
FROM "email_verification_tokens"
ORDER BY "createdAt";

-- Email xác minh gần đây đã gửi hay chưa
SELECT "to", "status", "attempts", "sentAt", "lastError"
FROM "email_outbox"
WHERE "idempotencyKey" LIKE 'credential:email-verification:%'
ORDER BY "createdAt" DESC LIMIT 20;
```

Token hết hạn được xoá khi có người thử dùng. Chưa có cron dọn token hết hạn chưa
từng được bấm, nên bảng sẽ tăng chậm theo thời gian.

## Xác minh thủ công

Chỉ làm khi người dùng thật sự không thể nhận email:

```sql
UPDATE "users" SET "emailVerified" = now() WHERE "email" = '<address>';
DELETE FROM "email_verification_tokens" WHERE "userId" = '<id>';
```

Ưu tiên dùng công cụ admin khi có, vì sửa SQL trực tiếp dễ nhập sai và thường
không tạo audit log.

## Phần chưa kiểm tra end-to-end

Luồng logic đã có test, gồm concurrent request và replay, nhưng repo này chưa gửi
email xác minh qua tài khoản Resend thật rồi bấm từ hộp thư thật. Trước khi có
người dùng, cần chạy một vòng hoàn chỉnh trên production hoặc staging bằng domain
gửi email đã xác minh.

## Từ ngữ cần nhớ

- **Credential:** thông tin dùng để chứng minh danh tính, như mật khẩu hoặc token.
- **Token:** chuỗi bí mật có thời hạn, dùng để thực hiện một thao tác.
- **Hash:** dấu vân tay một chiều; kiểm tra được giống nhau nhưng khó khôi phục dữ
  liệu gốc.
- **Replay:** dùng lại token đã tiêu thụ.
- **Enumeration:** dò xem email nào có tài khoản bằng khác biệt trong phản hồi.
- **Defence in depth:** nhiều lớp kiểm tra độc lập bảo vệ cùng một mục tiêu.
