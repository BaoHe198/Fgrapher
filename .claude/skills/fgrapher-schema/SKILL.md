---
name: fgrapher-schema
description: Quy ước schema Prisma và pattern kiến trúc đã chốt của Fgrapher (one-account-multi-role, Province/Ward, booking state machine, OTP auth). BẮT BUỘC dùng skill này trước khi viết hoặc sửa bất cứ thứ gì trong schema.prisma, tạo migration, thêm model/enum/relation mới, viết query Prisma, hoặc thiết kế API đụng tới User/Role/Booking/Province. Cũng dùng khi được hỏi "nên lưu cái này ở đâu", "thêm bảng gì", hay khi review code truy cập database — kể cả khi người dùng không nhắc tên Prisma.
---

# Fgrapher — Quy ước schema & pattern kiến trúc

Mục đích: agent không tự chế pattern mới. Những quyết định dưới đây đã chốt, chỉ
thay đổi khi người dùng nói rõ là muốn thay đổi.

## Đọc trước khi viết

1. `prisma/schema.prisma` — trạng thái hiện tại
2. `prisma/migrations/` — migration gần nhất, để không tạo trùng
3. Skill `fgrapher-compliance` — nếu model đụng tới dữ liệu cá nhân

## Pattern 1 — One account, multiple roles

**Không** tạo bảng `Photographer`, `Model`, `Studio` riêng. Một `User` giữ nhiều
role qua bảng nối.

```prisma
model User {
  id        String     @id @default(cuid())
  phone     String     @unique   // định danh chính, không phải email
  roles     UserRole[]
}

model UserRole {
  id     String   @id @default(cuid())
  userId String
  role   RoleType
  user   User     @relation(fields: [userId], references: [id])

  @@unique([userId, role])
}

enum RoleType {
  CUSTOMER
  PHOTOGRAPHER
  VIDEOGRAPHER
  MAKEUP_ARTIST
  MODEL
  STUDIO
  ADMIN
}
```

Hệ quả bắt buộc nhớ:

- Một người vừa là khách vừa là provider là chuyện bình thường, không phải edge case
- Booking phải tham chiếu **cặp (user, role)**, không chỉ userId — cùng một người
  có thể đặt với tư cách khách và nhận job với tư cách photographer
- Authorization check theo role, không theo "loại tài khoản"

## Pattern 2 — OTP authentication

Định danh chính là **số điện thoại**, không phải email. Lý do: thị trường VN,
provider dùng số điện thoại làm kênh liên lạc chính.

- Không có password ở MVP
- Bảng `OtpChallenge` có TTL, giới hạn số lần thử, và rate limit theo số điện thoại
- Chuẩn hoá số về dạng E.164 (`+84...`) **trước khi** lưu hoặc so sánh
- Email là optional, dùng cho thông báo, không dùng để đăng nhập

## Pattern 3 — Province / Ward

Sau sáp nhập 2025 còn **34 tỉnh/thành**. Cấp huyện đã bỏ — chỉ còn tỉnh → phường/xã.

```prisma
model Province {
  id      String  @id
  code    String  @unique   // mã hành chính chính thức
  name    String
  slug    String  @unique   // dùng cho SEO URL
  wards   Ward[]
}

model Ward {
  id         String   @id
  code       String   @unique
  name       String
  provinceId String
  province   Province @relation(fields: [provinceId], references: [id])
}
```

Quy tắc:

- **Không hardcode** tên tỉnh trong code. Luôn join từ bảng.
- `slug` là không dấu, chữ thường, nối bằng gạch ngang (`ho-chi-minh`, `da-nang`)
- Provider có thể phục vụ nhiều tỉnh → bảng nối `ProviderServiceArea`, không phải
  một cột `provinceId` duy nhất
- Search theo tỉnh là truy vấn nóng nhất → index `(provinceId, roleType, status)`

## Pattern 4 — Booking state machine

Chuyển trạng thái là **tường minh**, không được `update({ status: ... })` tuỳ tiện
ở bất kỳ đâu trong codebase.

```
DRAFT → REQUESTED → ACCEPTED → CONFIRMED → COMPLETED
                 ↘ REJECTED
                 ↘ CANCELLED_BY_CUSTOMER
                 ↘ CANCELLED_BY_PROVIDER
                            ↘ DISPUTED
```

Bắt buộc:

- Toàn bộ chuyển trạng thái đi qua **một** service duy nhất
  (`services/booking/transition.ts`), có bảng transition hợp lệ
- Mỗi lần chuyển ghi một dòng `BookingEvent` (ai, từ đâu, sang đâu, lúc nào, lý do)
- Không có trạng thái nào liên quan tới thanh toán ở MVP — tiền trao tay ngoài
  platform. Đừng thêm `PAID`, `REFUNDED`.

## Quy ước chung

- ID: `cuid()`, không dùng auto-increment int (lộ số lượng bản ghi)
- Thời gian: tất cả `DateTime` lưu UTC; hiển thị mới đổi sang `Asia/Ho_Chi_Minh`
- Soft delete: `deletedAt DateTime?` cho model có ràng buộc nghiệp vụ; hard delete
  chỉ khi có yêu cầu xoá dữ liệu cá nhân hợp lệ (xem skill compliance)
- Enum: định nghĩa trong Prisma, không dùng string tự do cho tập giá trị hữu hạn
- Tên: model `PascalCase` số ít, field `camelCase`, enum value `SCREAMING_SNAKE`
- Mọi foreign key phải có index nếu được dùng để lọc

## Trước khi tạo migration

- [ ] Đã đọc schema hiện tại chưa, model này có sẵn dưới tên khác không?
- [ ] Có đang tạo bảng riêng cho một role không? (vi phạm Pattern 1)
- [ ] Field mới có phải dữ liệu cá nhân không? → xem `fgrapher-compliance`
- [ ] Có hardcode tỉnh/thành ở đâu không?
- [ ] Có đường nào sửa `Booking.status` mà không qua transition service không?
- [ ] Migration có phá dữ liệu đang có không? Nếu có, nói trước với người dùng.

## Khi không chắc

Nếu một yêu cầu có vẻ cần pattern mới (ví dụ cần bảng riêng cho studio vì studio
có thuộc tính quá khác), **đề xuất và giải thích trade-off trước**, đừng tự quyết.
Người dùng muốn hiểu lý do đằng sau thay đổi kiến trúc, không chỉ kết quả.
