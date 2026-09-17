# Hướng dẫn phát triển Fgrapher

Tài liệu này hướng dẫn cách chạy dự án, sửa code và kiểm tra thay đổi an toàn.

## 1. Cài đặt local từ đầu

```bash
git clone <repo-url>
cd Fgrapher
pnpm install
cp .env.example .env
cp .env.example .env.local
```

Điền ít nhất:

- `DATABASE_URL` và `DIRECT_URL` của database dev;
- `NEXTAUTH_SECRET` là chuỗi ngẫu nhiên đủ dài;
- `NEXTAUTH_URL=http://localhost:3000`;
- `APP_ENV=development`.

`.env` phục vụ Prisma CLI; `.env.local` phục vụ Next.js. Hai file phải dùng cùng
database dev. Không chép secret production về máy.

Sau đó:

```bash
pnpm db:migrate:dev
pnpm db:seed
pnpm dev
```

Mở `http://localhost:3000`. Tài khoản seed và mật khẩu thử nằm trong
`prisma/seed.ts`; chúng chỉ dành cho dev.

### Ba lỗi cài đặt thường gặp

1. Prisma kết nối được nhưng app không kết nối: `.env` và `.env.local` đang lệch.
2. Lệnh database bị chặn: script an toàn phát hiện project ref không thuộc database
   dev đã cho phép. Hãy sửa kết nối, không bỏ chốt.
3. Đăng nhập quay lại trang login: kiểm tra `NEXTAUTH_URL`, cookie và
   `NEXTAUTH_SECRET`.

## 2. Cách làm một thay đổi

1. Đọc `CLAUDE.md`, tài liệu miền liên quan và code hiện tại.
2. Tạo nhánh có tên rõ nghĩa, ví dụ `fix/email-retry`.
3. Viết thay đổi nhỏ nhất giải quyết đúng vấn đề.
4. Thêm hoặc cập nhật test khi hành vi có rủi ro tái phát.
5. Chạy kiểm tra phù hợp.
6. Xem diff để chắc không sửa file ngoài phạm vi.
7. Tạo commit dạng `type(scope): mô tả`.

Ví dụ:

```text
feat(booking): add reschedule proposal
fix(auth): reject reused reset token
docs(ops): explain email retry process
```

Mỗi branch/PR có Vercel Preview và dùng chung database dev. Dữ liệu thử có thể bị
nhánh khác thay đổi, nên test cần tự tạo dữ liệu cần thiết thay vì giả định database
luôn sạch.

## 3. Thêm trang mới

1. Chọn route group đúng đối tượng: `(public)`, `(auth)`, `(dashboard)` hoặc
   `(admin)`.
2. Tạo `page.tsx`; mặc định để là Server Component.
3. Server Component gọi service trực tiếp thay vì gọi API của chính app.
4. Thêm metadata hoặc `generateMetadata` nếu trang công khai.
5. Thêm loading, empty, error và not-found state phù hợp.
6. Nếu cần chuỗi dịch, cập nhật cả `src/messages/vi.json` và `en.json`.
7. Kiểm tra mobile, desktop, bàn phím và dark mode.

Chỉ dùng Client Component khi cần state, event, effect hoặc API trình duyệt. Đẩy
`"use client"` xuống component lá để giảm JavaScript gửi cho người dùng.

## 4. Thêm API mới

1. Tạo `src/app/api/<resource>/route.ts`.
2. Gọi `requireAuth()`, `requireRole()` hoặc `requireAdmin()` nếu cần.
3. Parse và kiểm tra input bằng Zod.
4. Gọi hàm trong `src/services` để xử lý nghiệp vụ.
5. Chỉ lấy trường cần thiết từ Prisma và giới hạn danh sách.
6. Trả `{ data, error, message }` cùng status HTTP đúng.
7. Xử lý lỗi auth/domain trước lỗi 500 chung.
8. Thêm rate limit cho endpoint dễ bị spam hoặc gây chi phí.

Không tin user ID, role, giá tiền hoặc trạng thái do client gửi nếu server có thể tự
xác định từ session/database.

## 5. Thay đổi database

Đọc `docs/MIGRATIONS.md` trước. Quy trình ngắn:

```bash
# sửa prisma/schema.prisma
pnpm db:migrate:dev --name mo_ta_thay_doi
pnpm typecheck
```

Sau khi generate Prisma Client, khởi động lại `pnpm dev` nếu thấy lỗi kiểu dữ liệu
không khớp schema mới. Cập nhật Zod schema, seed, service và test liên quan.

Không dùng `db push` để thay migration đã được commit và không chạy lệnh dev với
production.

## 6. Thêm vai trò mới

Vai trò ảnh hưởng nhiều nơi hơn một enum. Cần rà:

- Prisma enum, `UserRole` và `Profile`;
- đăng ký, thêm/đổi vai trò và onboarding;
- quyền truy cập API;
- giá/gói và feature flag;
- hồ sơ, tìm kiếm, booking, thông báo;
- trang quản trị, seed và test;
- chuỗi tiếng Việt/Anh.

Dùng compiler và test để tìm mapping `Record<Role, ...>` còn thiếu. Không chỉ thêm
role ở giao diện.

## 7. Email và thông báo

### Email mới

1. Tạo template theo pattern hiện có trong `src/lib/email.ts`.
2. Gọi qua lớp outbox, không gửi trực tiếp rải rác trong route.
3. Tạo idempotency key để tránh email trùng.
4. Không ghi token nguyên văn vào payload/log.
5. Quyết định retry, hạn cuối và trường hợp phải bỏ email cũ.

### Notification mới

1. Thêm `NotificationType` và migration nếu cần.
2. Cập nhật policy trong service thông báo.
3. Chọn `notify()` hoặc `notifyCritical()`.
4. Nếu người dùng được quyền tắt, thêm preference và validation.
5. Cập nhật `docs/ops/notification-matrix.md`.

## 8. Dịch giao diện

1. Tạo cùng một key trong `src/messages/vi.json` và `en.json`.
2. Dùng `useTranslations()` ở client hoặc `getTranslations()` ở server.
3. Không để tiếng Anh làm placeholder trong file tiếng Việt.
4. Kiểm tra biến nội suy, số nhiều, ngày và tiền.
5. Với nội dung vận hành production, ưu tiên tiếng Việt rõ và trực tiếp.

Các file `docs/i18n-batches/*.json` là dữ liệu trung gian của hệ thống dịch, không
phải tài liệu hướng dẫn.

## 9. Các lệnh kiểm tra

```bash
pnpm lint       # quy tắc code
pnpm typecheck  # kiểu TypeScript
pnpm test       # unit/integration test trong src/**/__tests__
pnpm build      # build gần giống production
```

Kiểm thử trình duyệt:

```bash
pnpm test:e2e
pnpm test:e2e:ui
pnpm test:smoke
pnpm test:visual
```

E2E phải dùng `e2e/.env.test` và database thử riêng. Không bao giờ trỏ test có
reset/seed tới dev chung hoặc production.

Chọn mức kiểm tra theo thay đổi:

- Hàm policy/validation: unit test.
- Service có database/store: integration test với dependency giả hoặc database test.
- Luồng đăng ký/booking/thanh toán: E2E.
- CSS/layout quan trọng: visual test và kiểm tra tay trên nhiều kích thước.

## 10. Debug theo từng lớp

### Giao diện

- Mở DevTools Console và Network.
- Kiểm tra request bị gọi mấy lần, status và payload.
- Xem component có render hai bản rồi chỉ ẩn một bản bằng CSS không.
- Với hydration mismatch, so dữ liệu server và client render lần đầu.

### API/server

- Xem terminal local hoặc Vercel Logs.
- Theo request ID, user ID không nhạy cảm và thời điểm.
- Phân biệt validation, auth, lỗi nghiệp vụ và lỗi dịch vụ ngoài.
- Không log token, mật khẩu, cookie hoặc giấy tờ.

### Cơ sở dữ liệu (database)

- Xem query có lấy quá nhiều cột/dòng hoặc gây N+1 không.
- Bật Prisma query log tạm thời nếu cần rồi gỡ sau khi điều tra.
- Kiểm tra unique/index/foreign key và transaction.
- Nếu vừa migrate, restart dev server trước khi kết luận Prisma lỗi.

### Tích hợp bên ngoài

- Resend: xem trạng thái giao email và outbox.
- Cloudinary: xem upload signature, public ID và quyền truy cập.
- Sentry: xem stack trace và release.
- Thanh toán: xác minh chữ ký webhook, event ID và state transition.

## 11. Hiệu năng và tài nguyên

Trước khi tối ưu, đo:

- thời gian response và query;
- số request khi thao tác hoặc để tab mở;
- bundle/payload;
- CPU, memory và số kết nối database;
- số email/SMS/API trả phí.

Các cách cải thiện thường dùng trong dự án:

- chạy query độc lập bằng `Promise.all`;
- gom ghi bằng `createMany`/transaction;
- dùng cache cho dữ liệu công khai phù hợp và invalidate sau mutation;
- phân trang, `select` trường cần thiết;
- dừng polling khi tab ẩn và không cho request chồng nhau;
- dùng thumbnail và chỉ mount ảnh đang hiển thị.

Không cache dữ liệu nhạy cảm hoặc dữ liệu theo user bằng key dùng chung.

## 12. Trước khi mở pull request

- [ ] Đúng phạm vi và không chứa secret.
- [ ] UI có loading, empty, error; dùng được trên mobile.
- [ ] API kiểm tra auth, quyền và input ở server.
- [ ] Danh sách có giới hạn; query không có N+1 rõ ràng.
- [ ] Retry/webhook/cron chịu được chạy lặp.
- [ ] Migration tương thích và có cách rollback.
- [ ] Test phù hợp đã đạt.
- [ ] Tài liệu và biến môi trường đã cập nhật.

Xem `docs/ARCHITECTURE.md` để hiểu hệ thống và
`docs/ops/CAM-NANG-KIEN-THUC-IT-FGRAPHER.md` để học thuật ngữ.
