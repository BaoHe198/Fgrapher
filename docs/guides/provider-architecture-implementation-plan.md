# Kế hoạch kiến trúc Provider / Role / Service — bản trình duyệt

Ngày: 22/09/2026. Người viết: Claude. Trạng thái: **chờ chủ dự án duyệt, chưa
code dòng nào.** Đề bài: `docs/guides/fgrapher-provider-architecture-plan.md`.

Số liệu trong tài liệu này lấy từ **database dev thật** (`fgrapher-dev`) ngày
22/09/2026, không phải ước lượng.

## Hai chỗ đề bài nói khác thực tế

1. **"User định danh bằng số điện thoại, OTP"** — sai. Đăng nhập hiện tại là
   **email + mật khẩu** (NextAuth v5, `src/lib/auth.ts`), có bắt buộc xác minh
   email. Số điện thoại là trường phụ (`User.phone`, xác minh qua Twilio) chỉ
   dùng làm rào chống yêu cầu giả. Đổi sang OTP là một dự án riêng, không nằm
   trong kế hoạch này.
2. **"34 tỉnh, không còn quận/huyện"** — đúng, và dữ liệu đã có đủ: **34 tỉnh,
   3.321 phường/xã** trong DB dev (`prisma/data/nationwide-wards.ts`). Không có
   bảng, cột hay code nào còn dùng cấp quận/huyện. (Ghi chú: skill
   `fgrapher-schema` vẫn viết "chỉ seed 1 tỉnh HCM, 168 phường" — đã lỗi thời,
   cần sửa.)

---

# A. Kiến trúc hiện tại

## A.1 Role đang được lưu ở đâu

| Thành phần | Đường dẫn | Vai trò |
|---|---|---|
| `enum Role` (9 giá trị) | `prisma/schema.prisma:305` | Nguồn sự thật về vai trò |
| `UserRole` (bảng nối) | `prisma/schema.prisma:349` | Ai giữ vai trò nào + **trạng thái KYC** (`verificationStatus`) |
| `Profile` | `prisma/schema.prisma:632` | **Một dòng cho mỗi cặp (user, role)** — `@@unique([userId, role])` |
| Tập hợp vai trò | `src/lib/constants/index.ts` | `PAID_ROLES`, `PROVIDER_ROLES`, `PORTFOLIO_ROLES`, `SELLER_ROLES`, `SHOP_ROLES`, `BOOKABLE_ROLES_BY_ROLE`, `CATEGORIES_BY_ROLE`, `ROLE_SLUGS` |

**Điểm quan trọng: `Profile` đã gần như chính là "Provider Profile" mà đề bài
mô tả.** Nó đã có: một chủ sở hữu, đúng một vai trò chính, danh sách dịch vụ
(`Service[]`), ảnh (`ProfileMedia[]`), album, danh mục, tỉnh/phường, địa chỉ,
toạ độ, cờ công khai. Đây là lý do đề xuất ở mục B **mở rộng `Profile`, không
tạo bảng mới**.

## A.2 Service hiện tại KHÔNG phải "dịch vụ" theo nghĩa đề bài

`model Service` (`prisma/schema.prisma:932`) là **gói giá**: `name`, `price`,
`duration`, `description`. Nó không có khái niệm "loại dịch vụ" (chụp / quay /
trang điểm / cho thuê không gian). Hệ quả: **không thể tìm kiếm theo dịch vụ**,
chỉ tìm được theo vai trò. Đúng như đề bài nêu, studio có ekip chụp hiện không
biểu diễn được.

Dữ liệu dev: 65 gói giá, 4/4 studio đều đã khai gói.

## A.3 Lịch rảnh đang gắn vào **user**, không gắn vào hồ sơ

```
model Availability { userId, dayOfWeek, startTime "09:00", endTime "17:00" }
model BlockedDate  { userId, date, startTime?, endTime? }
model Booking      { providerId, serviceId?, date @db.Date, startTime "10:00", endTime? }
```

Ba điều cần nhìn thẳng:

1. **Lịch thuộc về con người, không thuộc về hồ sơ.** Một người vừa là
   photographer vừa là studio sẽ dùng chung một lịch. Hiện chỉ có **1/60** tài
   khoản giữ nhiều vai trò provider nên chưa ai gặp, nhưng model đang sai.
2. **Thời gian lưu dạng chuỗi `"HH:mm"` + cột `date`**, không phải mốc thời
   gian thật. Đề bài muốn chống trùng lịch **ở tầng database** bằng
   `tstzrange` — **không thể làm được với schema hiện tại**. Phải thêm
   `startAt`/`endAt` kiểu `timestamptz` trước.
3. Chống trùng lịch hiện **chỉ nằm ở tầng code** (`src/services/availability.ts`,
   `src/services/bookings.ts`). Hai request đồng thời vẫn có thể cùng đặt một
   khung giờ.

## A.4 Mức độ dính vào role của codebase

- **39 file** trong `src/` nhắc thẳng tên một vai trò cụ thể.
- **17 chỗ** dùng `Record<Role, …>` — TypeScript bắt buộc liệt kê đủ, nên đây
  vừa là gánh nặng vừa là lưới an toàn: thêm/bớt vai trò là `tsc` chỉ mặt ngay.
- Các cụm dính role đậm nhất: điều hướng (`web-nav.tsx`, `dashboard-sidebar.tsx`),
  hồ sơ công khai (`profile-interactive.tsx`), tìm kiếm (`services/search.ts`),
  Fmap (`services/fmap.ts`, `fmap-map.tsx` — icon theo vai trò),
  landing SEO (`src/app/(public)/[roleSlug]/[provinceSlug]`), bảng giá
  (`pricing-content.tsx`), đăng ký (`role-selection-form.tsx`).

## A.5 Những chỗ đang vi phạm chính quyết định đã chốt ở mục 0 của đề bài

| Quyết định đã chốt | Hiện trạng | Mức độ |
|---|---|---|
| One account, multiple roles | Data model cho phép, nhưng **self-service giới hạn 1 vai trò trả phí** (CLAUDE.md). Đây là quyết định MVP của chủ dự án, không phải lỗi. | Cần xác nhận lại: model mới có gỡ giới hạn này không? |
| Mọi chuyển trạng thái booking qua một service duy nhất | Đúng — `transitionBooking()` + `BookingStatusHistory` | Đạt |
| Không có trạng thái thanh toán trong booking | Đúng | Đạt |
| KYC bắt buộc cho mọi seller role | `UserRole.verificationStatus` có cho mọi vai trò | Đạt |
| ID `cuid()`, thời gian UTC | Đúng với `createdAt`… **nhưng giờ booking lưu chuỗi local** | **Vi phạm một phần** |
| Không hardcode địa danh | Đúng | Đạt |

## A.6 Vấn đề nếu giữ nguyên

1. Không tìm được theo dịch vụ → studio có ekip chụp không xuất hiện khi khách
   tìm "chụp ảnh"; muốn sửa bằng vai trò thì phải đẻ thêm vai trò, đúng thứ
   chủ dự án không muốn.
2. Không chống trùng lịch ở DB → sẽ có ngày hai khách đặt trùng.
3. Mỗi loại hình mới (equipment rental, retoucher, agency) lại là một vai trò
   mới, kéo theo 17 `Record<Role>` và 39 file phải sửa.
4. `ProfileServiceArea` đã có bảng nhưng **0 dòng dữ liệu** — vùng phục vụ trên
   thực tế chưa chạy, nên "tìm freelancer ở tỉnh X" hiện dựa vào tỉnh đóng đô.

---

# B. Kiến trúc đích

## B.1 Sơ đồ quan hệ

```
User ──┬── UserRole        (giữ vai trò + KYC + legalEntityType)
       └── Profile         = PROVIDER PROFILE  (1 dòng / cặp user+role)
              ├── primaryRole      = Profile.role          (enum Role, giữ nguyên)
              ├── serviceKinds[]   = ServiceKind[]         (MỚI, để tìm kiếm)
              ├── operatingMode    = SOLO | TEAM           (MỚI, cho phép null)
              ├── Service[]        (gói giá — THÊM cột kind: ServiceKind)
              ├── Venue[]          (MỚI — địa điểm cố định, cho phép nhiều)
              ├── ProfileServiceArea[]  (đã có — vùng phục vụ, thêm wardId)
              ├── BookableResource[]    (MỚI — Phase 1: đúng 1 dòng mặc định)
              │      ├── AvailabilityRule   (chuyển từ Availability.userId)
              │      ├── AvailabilityBlock  (chuyển từ BlockedDate.userId)
              │      └── BookingAllocation  (MỚI — startAt/endAt timestamptz)
              ├── ProfileMedia[] / Album[]  (đã có)
              └── [Phase 2] TeamMember[]
```

## B.2 Bốn lựa chọn đề bài yêu cầu phân tích

### 1. Provider Profile: bảng mới hay mở rộng cái đang có?

| Phương án | Ưu | Nhược |
|---|---|---|
| **Mở rộng `Profile` (đề xuất)** | `Profile` đã đúng hình dạng cần có; 0 dòng dữ liệu phải chuyển; mọi quan hệ (media, album, service, service area) đã trỏ vào nó | Tên "Profile" hơi mờ nghĩa so với "ProviderProfile" |
| Tạo bảng `ProviderProfile` mới | Tên rõ nghĩa | Phải chuyển 62 hồ sơ + 65 gói giá + ảnh + album, và sửa toàn bộ query đang trỏ `profileId`. Không đổi lại được gì về mặt khả năng |

**Đề xuất: mở rộng `Profile`.** Đây là thay đổi rẻ nhất có cùng kết quả.

### 2. Service: enum hay bảng lookup?

**Đề xuất: enum `ServiceKind`** (đồng ý với thiên hướng của chủ dự án), vì:
- Tập giá trị thay đổi rất chậm (5 giá trị Phase 1).
- Toàn bộ codebase đã theo quy ước "tập hữu hạn thì dùng enum Prisma" và
  TypeScript sẽ chỉ mặt mọi chỗ thiếu khi thêm giá trị mới.
- Bảng lookup cho admin tự thêm sẽ sinh dữ liệu rác và **không** giải quyết
  vấn đề thật: mỗi service mới vẫn cần UI, nhãn, SEO, quy tắc KYC riêng.

Giá trị Phase 1: `PHOTOGRAPHY, VIDEOGRAPHY, VENUE_RENTAL, MAKEUP, MODELING`.

**Ma trận vai trò → dịch vụ được phép**: đặt trong **một** file
`src/lib/constants/service-matrix.ts`, validate ở tầng service
(`createService`), không rải ra UI. Đề xuất giữ nguyên ma trận đề bài, với
một sửa đổi: **MAKEUP_ARTIST cũng nên được phép `MODELING`** nếu chủ dự án
muốn (nhiều MUA nhận làm mẫu tay/mặt) — cần chủ dự án quyết, mặc định là
không.

Về `VENUE_RENTAL` chỉ cho STUDIO: đồng ý cho Phase 1.

### 3. Operating Mode: lưu hay suy ra?

**Đề xuất: lưu, nhưng cho phép trống.** Suy ra từ vai trò sai đúng ở ca mà chủ
dự án đã chỉ ra: studio chỉ cho thuê không gian không phải "đội ngũ". Cách làm:
`operatingMode: OperatingMode?` (`SOLO | TEAM`), mặc định `SOLO` cho vai trò cá
nhân, **null** cho STUDIO cho tới khi chủ studio tự khai. Card chỉ hiện nhãn
khi có giá trị.

### 4. Freelancer trên Fmap: ẩn, vùng hay cluster?

**Đề xuất: giữ đúng cách đang chạy, không đổi.** Fmap hiện đã làm mờ toạ độ
provider bằng HMAC 300–650 m và **lọc bbox trên điểm đã làm mờ** (đã sửa lỗ
riêng tư này ngày 19/09). Bổ sung Phase 1: **venue của studio/shop hiển thị
chính xác** (địa chỉ kinh doanh, không phải nhà riêng), freelancer giữ nguyên
điểm mờ. Không cần cluster theo tỉnh — clustering hiện có đã xử lý mật độ.

---

# C. Thay đổi database

## C.1 Enum mới

```prisma
enum ServiceKind { PHOTOGRAPHY VIDEOGRAPHY VENUE_RENTAL MAKEUP MODELING }
enum LegalEntityType { INDIVIDUAL HOUSEHOLD_BUSINESS COMPANY }
enum OperatingMode { SOLO TEAM }
enum ResourceType { PROVIDER_SELF ROOM STAFF EQUIPMENT }   // Phase 1 chỉ dùng PROVIDER_SELF
```

## C.2 Cột thêm vào bảng đang có

| Bảng | Cột | Ghi chú |
|---|---|---|
| `Profile` | `serviceKinds ServiceKind[]` | Bản sao để tìm kiếm nhanh, sinh lại từ `Service.kind` |
| `Profile` | `operatingMode OperatingMode?` | null = chưa khai |
| `Service` | `kind ServiceKind` | **Bắt buộc**; backfill theo vai trò chủ hồ sơ |
| `UserRole` | `legalEntityType LegalEntityType?` | Đặt cạnh `verificationStatus` vì KYC phụ thuộc nó |
| `UserRole` | `legalEntityConfirmedAt DateTime?` | Phân biệt "chưa khai" với "đã xác nhận là cá nhân" |
| `Booking` | `startAt DateTime` / `endAt DateTime` | `timestamptz`; **điều kiện bắt buộc** để chống trùng ở DB |
| `ProfileServiceArea` | `wardId String?` | Đề bài cho phép tuỳ chọn tới phường/xã |

## C.3 Bảng mới

```prisma
model Venue {                    // địa điểm cố định, công khai chính xác
  id, profileId, name, address, wardId, provinceId, latitude, longitude,
  isPrimary Boolean, deletedAt
  @@index([provinceId]) @@index([profileId])
}

model BookableResource {         // Phase 1: đúng 1 dòng mỗi provider profile
  id, profileId, type ResourceType, name String?, isActive
  @@index([profileId, isActive])
}

model AvailabilityRule {         // thay Availability (đang khoá theo userId)
  id, resourceId, dayOfWeek Int, startTime String, endTime String, isActive
  @@index([resourceId, dayOfWeek])
}

model AvailabilityBlock {        // thay BlockedDate
  id, resourceId, startAt DateTime, endAt DateTime, reason String?
  @@index([resourceId, startAt])
}

model BookingAllocation {        // phần giữ chỗ của một booking
  id, bookingId, resourceId, startAt DateTime, endAt DateTime
  @@index([resourceId, startAt])
}
```

## C.4 Chống trùng lịch ở tầng database

Prisma không diễn đạt được `EXCLUDE`, nên viết SQL thô **trong một migration
Prisma bình thường** (Prisma chấp nhận SQL tự viết trong file migration):

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "booking_allocations"
  ADD CONSTRAINT booking_allocations_no_overlap
  EXCLUDE USING gist (
    "resourceId" WITH =,
    tstzrange("startAt", "endAt", '[)') WITH &&
  );
```

Hai điểm phải kiểm trước khi chạy trên production:
1. Supabase **có** cho tạo extension `btree_gist` (cần xác nhận trên project
   thật, không suy đoán).
2. Chỉ ghi `BookingAllocation` cho booking **đang giữ chỗ** (`PENDING`,
   `CONFIRMED`); khi booking chuyển sang `CANCELLED/DECLINED/EXPIRED/COMPLETED`
   thì **xoá dòng allocation** — như vậy không cần mệnh đề `WHERE` trong
   constraint, vốn là chỗ dễ sai nhất.

## C.5 Index cho truy vấn nóng

Truy vấn nóng nhất là "dịch vụ X + tỉnh Y + đang công khai [+ còn trống]".

```prisma
@@index([role, isPublished])                 // đã có
@@index([provinceId, isPublished])           // MỚI
// GIN cho mảng enum — viết SQL thô:
CREATE INDEX profiles_service_kinds_gin ON profiles USING gin ("serviceKinds");
```

**Không** đưa điều kiện "còn trống" vào truy vấn tìm kiếm: lọc trống cho hàng
trăm provider trên mỗi lần gõ phím là cách chắc chắn nhất để giết database.
Đề xuất: tìm kiếm trả về provider theo dịch vụ + khu vực, **chỉ tính lịch trống
khi người dùng mở lịch của một provider cụ thể** — đúng như luồng hiện tại.

## C.6 RLS

Supabase **Data API đã tắt** (chủ dự án tắt ngày 20/09 sau cảnh báo 51 issues),
mọi truy cập đi qua Prisma từ server. Vì vậy **không cần viết RLS policy** cho
các bảng mới. Nếu sau này bật lại Data API thì đó là một đợt riêng, và khi đó
phải viết policy cho **toàn bộ** bảng chứ không riêng bảng mới.

---

# D. Thay đổi backend / query

| Chỗ | Việc |
|---|---|
| `src/services/search.ts` | Lọc theo `serviceKinds` thay vì theo `role`; giữ lọc role làm bộ lọc phụ |
| `src/services/fmap.ts` | Marker lấy `serviceKinds` để chọn icon; venue hiện chính xác, freelancer giữ điểm mờ |
| `src/services/availability.ts` | Đọc `AvailabilityRule`/`AvailabilityBlock` theo `resourceId`; hàm public giữ nguyên chữ ký để UI không phải sửa |
| `src/services/bookings.ts` | `createBooking` ghi thêm `BookingAllocation`; `transitionBooking` xoá allocation khi booking kết thúc. **Vẫn là nơi duy nhất ghi `Booking.status`** |
| `src/app/api/services/*` | Nhận và validate `kind` theo ma trận; cập nhật `Profile.serviceKinds` trong cùng transaction |
| KYC (`src/services/verification.ts`, `/onboarding/verification`) | Nhánh giấy tờ theo `legalEntityType`: CCCD / giấy ĐKKD hộ / giấy ĐKDN |
| `src/services/public-profile.ts` | Trả `serviceKinds`, `venues`, `operatingMode` cho card và hồ sơ |

**Ràng buộc bất biến:** `transitionBooking()` vẫn là hàm duy nhất được ghi
`Booking.status` (skill `fgrapher-schema`). Allocation phải nằm trong **cùng
transaction** với việc tạo/chuyển trạng thái booking, nếu không sẽ có lúc
booking tồn tại mà chỗ không bị giữ.

---

# E. Thay đổi frontend

| Màn | Việc |
|---|---|
| Đăng ký (`role-selection-form.tsx`) | Bước 1 chọn vai trò chính (giữ nguyên); **bước mới**: chọn dịch vụ trong ma trận cho phép |
| Onboarding | Thêm bước hình thức pháp lý (ảnh hưởng KYC) và, với studio, câu hỏi SOLO/TEAM |
| Hồ sơ công khai | Hiện danh sách dịch vụ thay vì một nhãn vai trò; studio hiện venue chính xác |
| Card kết quả | Nhãn = vai trò chính + tối đa 2 dịch vụ; giá "Từ …" lấy gói rẻ nhất đang bật |
| Tìm kiếm / bộ lọc | Bộ lọc **theo dịch vụ** (mới) đứng trước bộ lọc vai trò |
| Fmap | Icon theo vai trò chính (giữ), thêm chip dịch vụ trong popup |
| Dashboard | Quản lý dịch vụ: mỗi gói giá phải chọn loại dịch vụ |
| Landing SEO | **Không đổi URL `/{roleSlug}/{provinceSlug}` ở Phase 1** (xem Rủi ro). Trang theo dịch vụ `/{serviceSlug}/{provinceSlug}` là việc Phase 1.5, thêm mới chứ không thay thế |

---

# F. Chiến lược migration

Theo đúng expand → backfill → dual-read → contract của đề bài.

**Bước 0 — sao lưu.** Supabase có backup tự động, nhưng vẫn chụp thủ công
trước khi chạy:
`pg_dump "$DIRECT_URL" -Fc -f fgrapher-prod-$(date +%F).dump`, lưu ngoài repo.

**Bước 1 — expand.** Một migration thêm toàn bộ enum, cột nullable, bảng mới.
Không xoá, không đổi nghĩa cột nào. `Service.kind` thêm dạng **nullable trước**,
chỉ siết `NOT NULL` sau khi backfill xong.

**Bước 2 — backfill (script idempotent, có `--dry-run`).**
`scripts/backfill-provider-architecture.ts`, in báo cáo trước khi ghi:

| Nhánh | Quy tắc | Số liệu dev hôm nay |
|---|---|---|
| `Service.kind` | Theo vai trò chủ hồ sơ | 65 gói |
| `Profile.serviceKinds` | Tập hợp `kind` của các gói đang bật | 62 hồ sơ |
| `BookableResource` | Tạo đúng 1 dòng `PROVIDER_SELF` mỗi hồ sơ provider | 60 hồ sơ provider |
| `AvailabilityRule` | Chuyển 420 dòng `Availability` từ `userId` → resource của hồ sơ provider của user đó | 420 |
| `AvailabilityBlock` | Chuyển 4 dòng `BlockedDate`, ghép `date`+`startTime` thành `timestamptz` theo `Asia/Ho_Chi_Minh` | 4 |
| `Booking.startAt/endAt` | Ghép `date` + `startTime`/`endTime` theo `Asia/Ho_Chi_Minh` | 13 |
| `BookingAllocation` | Chỉ cho booking `PENDING`/`CONFIRMED` | ≤13 |
| `Venue` | Tạo từ `Profile.address/lat/lng` **chỉ cho STUDIO + shop** | 4 studio + 2 shop |
| `legalEntityType` | **Để trống**, đánh dấu cần xác nhận | 60 |

**Ca phải dừng hỏi chủ dự án (đề bài mục 11):**
- **Tài khoản nhiều vai trò provider: đúng 1/60 tài khoản** (`multi@test.com`,
  dữ liệu seed). Vì con số là 1 và là dữ liệu thử, đề xuất **giữ hai profile
  riêng** và không viết code gộp. Nếu sau này có người thật muốn gộp thì làm
  thủ công.
- **Hồ sơ có toạ độ: 55/62; có địa chỉ chi tiết: 56/62.** Phần lớn là fixture
  QA (`fmap-qa-*@test.local`, 53 dòng) — **cần dọn trước khi backfill**, nếu
  không sẽ đẻ ra 53 venue rác.
- **Studio: 4/4 đều đã khai gói giá**, nên backfill dịch vụ cho studio có cơ
  sở, không phải đoán. Vẫn hiện banner "xác nhận dịch vụ của bạn".

**Bước 3 — dual-read.** Query đọc model mới; giữ một hàm đối chiếu chạy trong
test so kết quả cũ/mới cho availability (chỗ dễ sai nhất).

**Bước 4 — contract.** Xoá `Availability`, `BlockedDate`, `Booking.startTime/
endTime/date` trong **một migration riêng**, chỉ sau khi chủ dự án xác nhận
bằng văn bản. **Không nằm trong đợt đầu.**

---

# G. Phase 1 và tương lai

## Làm ngay (Phase 1)

Provider profile mở rộng; `ServiceKind` + ma trận; legal entity type + nhánh
KYC; operating mode; venue + service area; bookable resource (1 mặc định mỗi
hồ sơ) + availability rule/block + allocation + **exclusion constraint**;
`Booking.startAt/endAt`; giá "Từ …"; migration theo mục F.

**Booking nhiều dòng dịch vụ:** đề xuất **không làm ở Phase 1**. `Booking` hiện
có `serviceId` đơn. Đường mở rộng đã sẵn: `BookingAllocation` là bảng nhiều
dòng, nên Phase 2 thêm `BookingItem` và giữ `serviceId` cũ làm dòng đầu tiên là
đủ — không phải đập đi làm lại.

## Chuẩn bị nhưng chưa làm

| Mục Phase 2 | Phase 1 đã mở đường thế nào | Phase 2 cần thêm |
|---|---|---|
| Nhiều phòng, nhiều chi nhánh | `Venue` là quan hệ nhiều dòng; `BookableResource.type` đã có `ROOM` | Chỉ thêm dòng dữ liệu + UI. **Không cần bảng mới** |
| Nhân viên studio, lịch riêng | Availability/allocation đã gắn `resourceId`, không gắn provider | Bảng `TeamMember`, `ResourceType.STAFF`, + consent riêng của nhân viên |
| Nhiều người quản lý một studio | **Chưa mở đường.** Hiện `Profile.userId` là một chủ sở hữu duy nhất | Bảng `ProfileMember(profileId, userId, role)` — không tạo trước ở Phase 1 |
| Equipment rental / Camera shop | `SELLER_ROLES` + Chợ F đã tách khỏi booking (nhánh `codex/role-capabilities-shops`, 22/09) | Thêm `ServiceKind.EQUIPMENT_RENTAL` nếu muốn thuê qua booking |
| Revenue split | Không liên quan schema này | Phụ thuộc thanh toán |

---

# H. Rủi ro

1. **Đổi lịch từ `userId` sang `resourceId` là thay đổi phá vỡ lớn nhất.** 420
   dòng lịch + toàn bộ `services/availability.ts` + màn lịch của dashboard.
   Giảm rủi ro: giữ chữ ký hàm public, dual-read, test đối chiếu.
2. **`timestamptz` + múi giờ.** Ghép `date` + `"HH:mm"` phải diễn giải theo
   `Asia/Ho_Chi_Minh`; làm sai một lần là lệch toàn bộ lịch sử booking. Backfill
   phải in mẫu 10 dòng cho người thật đọc trước khi ghi.
3. **`btree_gist` trên Supabase** — chưa xác nhận. Nếu không tạo được extension,
   phương án dự phòng là khoá bi quan (`SELECT … FOR UPDATE` trên dòng resource)
   trong transaction tạo booking; chậm hơn nhưng vẫn đúng.
4. **Hiệu năng tìm kiếm**: mảng `serviceKinds` cần index GIN, nếu quên thì
   nhanh chóng thành quét toàn bảng khi dữ liệu lớn.
5. **SEO**: `/{roleSlug}/{provinceSlug}` đang được sitemap và landing dùng. Đổi
   sang service slug mà không 301 sẽ mất hết trang đã index. Vì vậy Phase 1
   **giữ nguyên URL cũ**, chỉ thêm trang mới sau.
6. **Compliance**: hình thức pháp lý quyết định loại giấy tờ KYC (Luật
   122/2025) — khai sai loại là hồ sơ KYC sai. Dữ liệu nhân viên (Phase 2) cần
   consent của chính nhân viên, không phải của chủ studio.
7. **53 fixture QA** đang nằm trong DB dev sẽ làm bẩn mọi báo cáo backfill nếu
   không dọn trước.
8. **Vai trò shop vừa đổi nghĩa hôm nay** (xem mục J.1) — kế hoạch này giả định
   shop **không** tham gia booking/portfolio, đúng theo nhánh vừa merge.

---

# I. Thứ tự thực hiện

Mỗi bước để hệ thống ở trạng thái chạy được.

```
1.  Dọn 53 fixture QA khỏi DB dev                         (nửa buổi)
2.  Migration expand: enum + cột nullable + bảng mới       (1 phiên)
3.  Script backfill + báo cáo dry-run  → DỪNG CHỜ DUYỆT    (1 phiên)
4.  Chạy backfill; siết Service.kind thành NOT NULL        (nửa phiên)
5.  service-matrix.ts + validate ở tầng service + API      (1 phiên)
6.  Query layer đọc model mới (search, fmap, public-profile)(1–2 phiên)
7.  Availability/booking chuyển sang resource + allocation  (2 phiên)
8.  Exclusion constraint + test chống đặt trùng đồng thời   (1 phiên)
9.  KYC theo legalEntityType                                (1 phiên)
10. Onboarding + dashboard dịch vụ                          (1–2 phiên)
11. Hồ sơ, card, bộ lọc tìm kiếm, Fmap                      (2 phiên)
12. Trang landing theo dịch vụ (thêm mới, giữ URL cũ)       (1 phiên)
13. Contract — xoá bảng/cột cũ  → CHỈ SAU KHI XÁC NHẬN      (nửa phiên)
```

Tổng ước lượng: **13–16 phiên** cho bước 1–12, chưa tính bước 13.

---

# J. Câu hỏi cần chủ dự án quyết

Xếp theo mức ảnh hưởng.

1. ~~Shop trang phục: chốt một đường.~~ **Đã chốt 22/09/2026.** Hồ sơ shop
   trang phục **chỉ có tab "Trang phục"**; không lên Chợ F, không portfolio,
   không gói dịch vụ, không đặt lịch — thuê thì nhắn tin. Đã thực hiện. Kế
   hoạch này giả định mô hình đó, nên `COSTUME_SHOP` **không** nằm trong nhóm
   provider ở mục B (không có bookable resource, không có availability).
2. **Có gỡ giới hạn "mỗi tài khoản một vai trò trả phí" không?** Model mới cho
   phép nhiều hồ sơ provider; giới hạn hiện tại là quyết định MVP của anh.
3. **Hình thức pháp lý của provider cũ**: hỏi lại khi đăng nhập, hay chặn ở
   bước KYC? (Tôi đề xuất: banner nhắc, chỉ chặn khi họ muốn được duyệt hồ sơ.)
4. **Có lưu Operating Mode không** — tôi đề xuất có, cho phép trống.
5. **Ma trận dịch vụ**: giữ đúng bảng trong đề bài chứ? Riêng MUA có được nhận
   `MODELING` không?
6. **Đổi `Booking` sang mốc thời gian thật** — bắt buộc nếu muốn chống trùng ở
   DB. Đồng ý chứ?
7. **Tài khoản nhiều vai trò**: giữ hai hồ sơ riêng (đề xuất) hay gộp một hồ sơ
   nhiều dịch vụ?
8. **Có làm trang landing theo dịch vụ ở Phase 1 không**, hay để Phase 1.5 như
   tôi đề xuất?

---

**Chưa code gì cho tới khi anh duyệt.**
