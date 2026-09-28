# Báo cáo lịch sử: migration email, trạng thái deploy và cron gửi lại

> Báo cáo được tạo khi chuỗi migration email mới xuất hiện. Số migration pending và
> trạng thái dev/production đã có thể thay đổi. Hãy chạy lệnh read-only mới trước
> mọi quyết định.

## 1. Kết quả chính lúc audit

- Database dev thiếu năm migration email.
- Production không thiếu các migration đó.
- Thứ tự SQL của năm migration được đánh giá có thể deploy an toàn nếu chạy đúng
  thứ tự.
- Cơ chế Postgres advisory transaction lock dùng để chống request đồng thời được
  đánh giá đúng.
- Lịch `email-retry` mong muốn không khớp giới hạn Vercel Hobby.

## 2. Chuỗi thay đổi email

Các migration liên quan lần lượt:

1. tạo enum/trạng thái và bảng `email_outbox`;
2. thêm loại notification/email liên quan;
3. bổ sung cột/constraint/index cho retry và idempotency;
4. hỗ trợ credential email/reset an toàn hơn;
5. chuyển token nhạy cảm sang dạng hash.

Nguyên tắc khi chuỗi migration phụ thuộc nhau:

- không áp dụng file sau trước file trước;
- đọc SQL và kiểm tra enum/cột/index đã tồn tại;
- xem Prisma migration status trên đúng database;
- không đánh dấu applied chỉ vì “nghĩ là schema giống”.

## 3. Kiểm tra chỉ đọc trước khi chạy

```bash
pnpm prisma migrate status
```

Ngoài trạng thái Prisma, cần kiểm tra:

- tên database/project ref;
- bảng/cột/enum có đúng như migration dự kiến;
- số dòng bị ảnh hưởng bởi backfill;
- giá trị null/trùng sẽ làm constraint thất bại;
- có drift giữa schema và lịch sử migration không.

Không chạy `migrate dev` hoặc `db push` với production.

## 4. Vì sao dev thiếu migration gây lỗi?

Code mới có thể đọc/ghi:

- bảng outbox;
- trạng thái retry;
- idempotency key;
- token hash;
- các cột thời điểm gửi/lỗi/lần thử.

Nếu schema dev cũ, trang đăng ký, quên mật khẩu hoặc cron có thể lỗi dù production
vẫn hoạt động. Đây là **schema drift giữa môi trường**, không nhất thiết là lỗi code
ứng dụng.

## 5. Quy trình áp dụng và rollback

Với dev đã xác nhận đúng project:

```bash
pnpm db:migrate:dev
```

Với production, dùng pipeline `prisma migrate deploy` có bước duyệt. Trước khi
chạy:

1. backup/PITR sẵn sàng;
2. SQL đã được đọc;
3. code cũ và code mới chịu được cửa sổ deploy;
4. có query xác nhận sau migration;
5. có kế hoạch xử lý migration failed trong `_prisma_migrations`.

Rollback schema không tự động đi cùng rollback Vercel. Xem `docs/MIGRATIONS.md`.

## 6. Cron `email-retry` và Vercel

Email retry cần chạy đủ thường xuyên để người dùng không chờ quá lâu. Lịch vài phút
có thể không được Vercel Hobby hỗ trợ.

Các lựa chọn:

- Vercel Pro và cron theo SLA mong muốn;
- scheduler ngoài gọi endpoint có Bearer `CRON_SECRET`;
- giữ Hobby với lịch thưa hơn và chấp nhận thời gian chờ;
- bổ sung thao tác retry có kiểm soát cho admin.

Dù chọn cách nào, tài liệu, `vercel.json` và kỳ vọng sản phẩm phải giống nhau.

## 7. Advisory lock

Code dùng `pg_advisory_xact_lock` để tuần tự hoá thao tác theo một khoá logic, ví
dụ một user/credential. Hậu tố `_xact` nghĩa là lock tự nhả khi transaction commit
hoặc rollback.

Điều cần giữ:

- lấy lock bên trong cùng transaction với các lệnh đọc/ghi;
- tạo key ổn định và có namespace để tránh va chạm;
- không dựa vào return row count của câu SELECT lock;
- mọi đường cạnh tranh phải tuân cùng quy tắc lock;
- vẫn cần unique constraint làm hàng rào cuối.

## 8. Phát hiện phụ

Audit cũ ghi nhận:

- RLS bị tắt trên các bảng public của database dev được kiểm tra; app dựa vào Prisma
  server-side. Đây không tự động là lỗ hổng, nhưng credential Supabase phía client
  phải được quản lý cẩn thận.
- Một số comment/tài liệu về database an toàn và cron đã cũ.
- Cần tránh sửa comment mà không sửa nguồn hành vi thực tế.

## 9. Việc cần chủ dự án quyết định

- Mức chậm tối đa chấp nhận được cho email xác minh/reset.
- Nâng gói Vercel hay dùng scheduler ngoài.
- Người nhận cảnh báo khi outbox tích tụ.
- Thời hạn giữ lịch sử email đã gửi/thất bại.
- Quy trình retry thủ công và ai được quyền thực hiện.

Chi tiết vận hành hiện tại nằm trong `docs/ops/email-outbox.md` và
`docs/ops/email-verification.md`.
