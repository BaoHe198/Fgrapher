---
name: fgrapher-schema
description: Quy ước schema Prisma và pattern kiến trúc đã chốt của Fgrapher (one-account-multi-role, Province/Ward, booking state machine, auth bằng email + mật khẩu). BẮT BUỘC dùng skill này trước khi viết hoặc sửa bất cứ thứ gì trong schema.prisma, tạo migration, thêm model/enum/relation mới, viết query Prisma, hoặc thiết kế API đụng tới User/Role/Booking/Province. Cũng dùng khi được hỏi "nên lưu cái này ở đâu", "thêm bảng gì", hay khi review code truy cập database — kể cả khi người dùng không nhắc tên Prisma.
---

# Fgrapher — Quy ước schema & pattern kiến trúc

Mục đích: agent không tự chế pattern mới. Những quyết định dưới đây đã chốt và
**đã nằm trong code**, chỉ thay đổi khi người dùng nói rõ là muốn thay đổi.

## Đọc trước khi viết

1. `prisma/schema.prisma` (~1.640 dòng) — trạng thái hiện tại. Comment trong file
   này giải thích **vì sao** từng quyết định như vậy; đọc comment trước khi sửa field.
2. `prisma/migrations/` — migration gần nhất, để không tạo trùng
3. Skill `fgrapher-compliance` — nếu model đụng tới dữ liệu cá nhân
4. Skill `role-permissions` — nếu đụng tới quyền theo role

## Pattern 1 — One account, multiple roles

**Không** tạo bảng `Photographer`, `Model`, `Studio` riêng. Một `User` giữ nhiều
role qua bảng nối `UserRole`.

```prisma
enum Role {
  PHOTOGRAPHER
  VIDEOGRAPHER
  MAKEUP_ARTIST
  STUDIO
  CAMERA_SHOP   // sau flag MARKETPLACE_ENABLED
  MODEL
  CUSTOMER
  ADMIN         // không chọn được khi đăng ký — cấp tay qua scripts/make-admin.ts
}

model UserRole {
  id     String @id @default(cuid())
  userId String
  role   Role
  active Boolean @default(true)
  // + toàn bộ cụm xác minh danh tính — xem skill fgrapher-compliance
  @@unique([userId, role])
}
```

Enum tên là **`Role`**, không phải `RoleType`. Có **8** giá trị.

Hệ quả bắt buộc nhớ:

- Một người vừa là khách vừa là provider là chuyện bình thường — `CUSTOMER` luôn
  đi kèm và không bị tính là role trả phí
- **Giới hạn MVP: mỗi tài khoản chỉ có tối đa MỘT role trả phí đang hoạt động**
  (`PAID_ROLES` trong `src/lib/constants/index.ts`). Chặn cả ở client lẫn server
  (`/api/auth/register`, `/api/users/roles`).
- Role **chưa xác minh** thì tự gỡ và đổi sang role khác được. Role **đã xác minh**
  thì không — phải qua `RoleChangeRequest`, admin duyệt tại
  `/admin/role-change-requests` (`services/role-change-requests.ts`).
- `Profile` là **một dòng cho mỗi cặp (user, role)** — `@@unique([userId, role])`,
  không phải một profile cho cả tài khoản
- Booking tham chiếu `customerId`/`providerId` là userId; với booking thuê ê-kíp
  còn có thêm `requesterRole`/`recipientRole` để biết vai trò nào đang giao dịch
- Authorization check theo role, không theo "loại tài khoản" — dùng
  `requireRole()` / `requireActiveSubscription()` trong `src/lib/auth-helpers.ts`

## Pattern 2 — Authentication: email + mật khẩu (NextAuth v5)

Đây là hiện trạng, **không phải OTP số điện thoại**:

- Định danh đăng nhập là `User.email` (`@unique`), mật khẩu băm ở `passwordHash`
- NextAuth v5, Prisma adapter, có cả credentials lẫn Google OAuth
- **Bắt buộc xác minh email** với tài khoản đăng ký bằng mật khẩu: `authorize()`
  trong `lib/auth.ts` từ chối đăng nhập tới khi bấm link trong email
  (`EmailVerificationToken`, xem `docs/ops/email-verification.md`). OAuth không bị.
- Toàn bộ email transactional đi qua outbox có cron retry — `model EmailOutbox`,
  `docs/ops/email-outbox.md`

Số điện thoại là **phụ**, không dùng để đăng nhập:

- `User.phone` nullable; `phoneVerified`/`phoneVerifiedAt` xác minh qua Twilio
  Verify (`lib/sms.ts`)
- Chỉ dùng làm rào chống request giả khi đăng `ServiceRequest`, và chỉ khi
  `PHONE_VERIFICATION_REQUIRED=true`
- Đổi `phone` thì `phoneVerified` bị reset về `false` (xem PATCH của `/api/users/me`)

Nếu ai đó muốn chuyển sang đăng nhập bằng OTP: đó là **thay đổi kiến trúc lớn**
(NextAuth provider, migration, email verification, seed, mọi test) — đề xuất và
ước lượng trước, đừng bắt tay làm ngay.

## Pattern 3 — Province / Ward

Sau sáp nhập 2025, cấp huyện đã bỏ — chỉ còn tỉnh → phường/xã. Schema hai cấp:

```prisma
model Province {
  id   String @id @default(cuid())
  code String @unique   // ĐÂY LÀ SLUG dùng cho URL, không phải mã GSO
  name String
  wards Ward[]
}

model Ward {
  id         String @id @default(cuid())
  provinceId String
  code       String // số thứ tự zero-pad ("001"), duy nhất trong tỉnh
  name       String
  @@unique([provinceId, code])
}
```

Quy tắc:

- **Không có field `slug`.** `Province.code` chính là slug (không dấu, chữ thường,
  gạch ngang) và là thứ xuất hiện trong URL `/{roleSlug}/{provinceSlug}`.
- `code` **không phải** mã hành chính GSO chính thức — đợt sáp nhập 2025 đã
  đổi/bỏ các mã đó và dự án chưa có bảng ánh xạ đáng tin. Đừng khẳng định ngược lại.
- **Không hardcode** tên tỉnh trong code hay component (CLAUDE.md mục 9). Luôn join.
- **Hiện chỉ seed 1 tỉnh: Hồ Chí Minh** (168 phường) — `prisma/data/provinces-registry.ts`
  và `prisma/data/hcmc-wards.ts`. Thêm tỉnh = sửa seed, **không** sửa schema.
  Đừng viết code hay nội dung giả định "34 tỉnh đã có dữ liệu".
- Provider phục vụ nhiều tỉnh → bảng nối `ProfileServiceArea` (`profileId`,
  `provinceId`, `isPrimary`), song song với `Profile.provinceId`/`wardId` là nơi
  họ đóng đô thật
- `User.location` là free-text cũ, **chỉ để hiển thị**; muốn lọc/sắp xếp thật thì
  dùng `wardId`/`provinceId`
- Tỉnh chưa có provider thì ghi nhận nhu cầu vào `WaitlistEntry`

## Pattern 4 — Booking state machine

Trạng thái thật:

```prisma
enum BookingStatus {
  PENDING CONFIRMED DECLINED COMPLETED CANCELLED NO_SHOW EXPIRED
}
```

Bảng chuyển trạng thái hợp lệ (`VALID_TRANSITIONS` trong `src/services/bookings.ts`):

```
PENDING   → CONFIRMED | DECLINED | EXPIRED | CANCELLED
CONFIRMED → COMPLETED | CANCELLED | NO_SHOW
DECLINED / COMPLETED / CANCELLED / NO_SHOW / EXPIRED → (kết thúc)
```

Bắt buộc:

- **`transitionBooking()` trong `src/services/bookings.ts` là hàm DUY NHẤT được
  ghi `Booking.status`.** Ngoại lệ duy nhất: `createBooking()` insert dòng đầu ở
  `PENDING` (đó là tạo mới, không phải chuyển trạng thái). Không `db.booking.update({ status })`
  ở bất kỳ đâu khác.
  (Không có file `services/booking/transition.ts` — đừng tạo bản sao.)
- Mỗi lần chuyển ghi một dòng `BookingStatusHistory` (`fromStatus`, `toStatus`,
  `actorId`, `note`, `createdAt`). `actorId` chỉ được null với chuyển trạng thái
  do hệ thống (cron `EXPIRED`).
- `EXPIRED` do cron `/api/cron/expire-bookings` đặt (booking `PENDING` quá
  `expiresAt` = tạo + 48h), không bao giờ do người dùng bấm
- **Không có trạng thái thanh toán trong `BookingStatus`.** Tiền trao tay ngoài
  platform ở MVP. Đừng thêm `PAID`, `REFUNDED`. (`Booking.depositPaid` là cờ
  provider tự tick bằng tay, không nối với cổng thanh toán nào.)
- Huỷ booking cha **không** tự huỷ booking con trong luồng thuê ê-kíp — chỉ báo
  cho provider con tự quyết. Đọc comment trong `model Booking` trước khi đổi.

## Quy ước chung

- ID: `cuid()`, không dùng auto-increment int (lộ số lượng bản ghi)
- Thời gian: tất cả `DateTime` lưu UTC; hiển thị mới đổi sang `Asia/Ho_Chi_Minh`
- Soft delete: `deletedAt DateTime?` cho model có ràng buộc nghiệp vụ; xoá dữ liệu
  cá nhân đi theo `processDeletion()` (xem skill `fgrapher-compliance`), không phải
  `db.user.delete()`
- Enum: định nghĩa trong Prisma, không dùng string tự do cho tập giá trị hữu hạn
- Tên: model `PascalCase` số ít, field `camelCase`, enum value `SCREAMING_SNAKE`,
  `@@map("snake_case_số_nhiều")` cho tên bảng
- Mọi foreign key dùng để lọc phải có index
- Tham chiếu lỏng `targetType`/`targetId` (không phải relation Prisma) là pattern
  đã dùng ở `AuditLog`, `Report`, `AdminAction` — giữ nguyên khi một hành động có
  thể trỏ tới nhiều loại model

## Trước khi tạo migration

- [ ] Đã đọc schema hiện tại chưa, model này có sẵn dưới tên khác không?
- [ ] Có đang tạo bảng riêng cho một role không? (vi phạm Pattern 1)
- [ ] Field mới có phải dữ liệu cá nhân không? → xem `fgrapher-compliance`
- [ ] Có hardcode tỉnh/phường ở đâu không?
- [ ] Có đường nào ghi `Booking.status` mà không qua `transitionBooking()` không?
- [ ] Migration có reversible không, tên có rõ nghĩa không? (CLAUDE.md)
- [ ] Migration có phá dữ liệu đang có không? Nếu có, nói trước với người dùng.
- [ ] Đã chạy `pnpm db:generate` và cập nhật `docs/` tương ứng chưa?

Lệnh: `pnpm db:migrate:dev` (chỉ local, có guard `scripts/check-db-safety.mjs`).
Migration đi **dev → preview → production**, không bao giờ thẳng lên production.

## Khi không chắc

Nếu một yêu cầu có vẻ cần pattern mới (ví dụ cần bảng riêng cho studio vì studio
có thuộc tính quá khác), **đề xuất và giải thích trade-off trước**, đừng tự quyết.
Người dùng muốn hiểu lý do đằng sau thay đổi kiến trúc, không chỉ kết quả.
