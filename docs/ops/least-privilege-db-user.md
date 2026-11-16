# User database quyền tối thiểu cho web (checklist việc 35)

Hiện web đăng nhập database bằng user `postgres`, quyền cao nhất. Nếu chuỗi kết nối
trên Vercel bị lộ, người có nó xoá được cả bảng. Sau khi làm theo trang này, web dùng
user `fgrapher_app`: chỉ đọc/thêm/sửa/xoá dòng dữ liệu, không tạo/sửa/xoá/làm rỗng
bảng, không tạo user, không vượt Row Level Security.

`postgres` vẫn giữ cho việc thay đổi cấu trúc database: GitHub Actions chạy migration
bằng secret `PRODUCTION_DIRECT_URL`, không qua Vercel.

**Đã thử trên database dev (16/11/2026)** với một user tạm tạo từ đúng file SQL bên
dưới, kết nối qua pooler như web: đọc, ghi, câu SQL tìm kiếm tự viết và khoá giao dịch
đều chạy; đọc sổ migration, tạo/xoá/sửa/làm rỗng bảng và tạo user đều bị chặn. User
tạm đã được xoá sau khi thử.

## Các bước (khoảng 15 phút)

1. **Tạo mật khẩu**: 32 ký tự trở lên, chỉ chữ và số (không dùng `@ : / ? #`). Lưu
   vào trình quản lý mật khẩu.
2. **Supabase** → project `fgrapher-prod` → SQL Editor → New query. Dán toàn bộ
   [`scripts/sql/create-app-db-role.sql`](../../scripts/sql/create-app-db-role.sql),
   thay `<STRONG_PASSWORD>` bằng mật khẩu ở bước 1, bấm Run.
3. **Kiểm tra Row Level Security** (cùng SQL Editor):

   ```sql
   SELECT relname FROM pg_class
   WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relrowsecurity;
   ```

   Phải ra **0 dòng**. Nếu có bảng nào (ví dụ đã bấm "Enable RLS" theo gợi ý của
   Supabase), dừng lại và báo lập trình viên: user mới sẽ không đọc được bảng đó.

4. **Tạo hai chuỗi kết nối mới.** Lấy chuỗi hiện có trên Vercel, chỉ thay phần trước
   dấu `@`:
   - `postgres.<ref>:<mật khẩu cũ>` → `fgrapher_app.<ref>:<mật khẩu mới>`
   - giữ nguyên host, cổng (`6543` cho `DATABASE_URL`, `5432` cho `DIRECT_URL`) và
     phần `?pgbouncer=true` nếu có.
5. **Vercel** → Settings → Environment Variables → môi trường **Production**: sửa
   `DATABASE_URL` và `DIRECT_URL` thành hai chuỗi mới. (Web cần cả hai biến để khởi
   động; Vercel không chạy migration nên `DIRECT_URL` ở đây cũng dùng user mới được.)
6. **Redeploy** bản production đang chạy (Deployments → ⋯ → Redeploy), rồi mở trang
   chủ, Tìm kiếm F, đăng nhập, `/api/health`. Có lỗi thì làm phần "Quay lại" bên dưới.
7. **Không đổi** GitHub Secrets `PRODUCTION_DATABASE_URL` / `PRODUCTION_DIRECT_URL`:
   migration cần quyền `postgres`.

Nên làm cùng lúc với việc 29 (đổi mật khẩu `postgres`): khi đó mật khẩu `postgres`
mới chỉ cần cập nhật vào GitHub Secrets, không còn nằm trên Vercel.

## Quay lại

- Nhanh: trên Vercel đặt lại `DATABASE_URL` / `DIRECT_URL` như cũ rồi Redeploy.
- Xoá hẳn user (SQL Editor), sau khi Vercel đã quay về chuỗi cũ:

  ```sql
  REVOKE ALL ON ALL TABLES IN SCHEMA public FROM fgrapher_app;
  REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM fgrapher_app;
  ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM fgrapher_app;
  ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM fgrapher_app;
  REVOKE USAGE ON SCHEMA public FROM fgrapher_app;
  REVOKE CONNECT ON DATABASE postgres FROM fgrapher_app;
  DROP ROLE fgrapher_app;
  ```

  (`DROP ROLE` một mình sẽ báo lỗi vì user còn giữ quyền trên các bảng, nên phải thu
  hồi trước.)

## Cho lập trình viên

- Bảng mới do migration tạo (chạy bằng `postgres`) tự cấp quyền cho `fgrapher_app`
  nhờ `ALTER DEFAULT PRIVILEGES`. Migration tạo bảng bằng user khác `postgres` thì phải
  tự `GRANT`.
- Code cần quyền ngoài đọc/ghi dòng (DDL lúc chạy, `TRUNCATE`, tạo extension) sẽ lỗi
  `42501 permission denied` trên production: đưa phần đó vào migration.
- Muốn thử lại trên dev: tạo user tên khác (ví dụ `fgrapher_app_selftest`) từ cùng
  file SQL, thử, rồi xoá bằng phần "Quay lại".
