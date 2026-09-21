# Fgrapher — Provider / Role / Service Architecture Planning

Tôi đang phát triển Fgrapher — nền tảng kết nối khách hàng với các provider trong ngành nhiếp ảnh, quay phim và sự kiện tại Việt Nam.

**CHƯA CODE.** Nhiệm vụ của bạn trong phiên này là review codebase và viết implementation plan. Không sửa file, không tạo migration cho tới khi tôi review và approve plan.

---

# 0. ĐỌC TRƯỚC KHI LÀM BẤT CỨ ĐIỀU GÌ

1. `CLAUDE.md` và mọi tài liệu kiến trúc trong repo (nếu có).
2. Các skill của dự án, nếu có trong repo: `fgrapher-schema`, `fgrapher-compliance`, `fgrapher-seo-landing`. Những quy ước trong đó là quyết định đã chốt. Plan không được vi phạm chúng; nếu thấy cần vi phạm, nêu rõ lý do và trade-off để tôi quyết.
3. `prisma/schema.prisma` và `prisma/migrations/` gần nhất.
4. Nếu codebase dùng Supabase: xác định rõ Supabase đóng vai trò gì (chỉ Postgres host, hay có dùng Auth, RLS, Storage, client query trực tiếp). **Không được trộn** migration SQL viết tay với Prisma migrate mà không nói rõ. Nếu cần SQL thô (constraint, RLS), plan phải chỉ rõ nó nằm trong migration nào và chạy bằng cơ chế nào.
5. `docs/legal/` nếu có. Nếu chưa có, nói cho tôi biết, không tự bịa số điều khoản.

Các quyết định đã chốt mà plan phải tôn trọng:

- **One account, multiple roles**: một `User` (định danh bằng số điện thoại, OTP) có thể vừa là khách vừa là provider. Không có khái niệm "loại tài khoản" cố định.
- **Province → Ward**: sau sáp nhập 2025 còn 34 tỉnh/thành, **không còn cấp quận/huyện**. Không thêm lại cấp quận, không hardcode tên địa danh.
- **Booking state machine**: mọi chuyển trạng thái đi qua một transition service duy nhất, có `BookingEvent`. Không có trạng thái thanh toán ở MVP.
- **Không thanh toán online ở MVP** (Stripe không hoạt động cho doanh nghiệp VN; code để sau feature flag, không xoá).
- **KYC bắt buộc cho mọi seller role**, pre-publication moderation cho media, consent tách theo mục đích.
- ID dùng `cuid()`, thời gian lưu UTC và hiển thị theo `Asia/Ho_Chi_Minh`, enum cho tập giá trị hữu hạn, soft delete bằng `deletedAt`.

---

# 1. VẤN ĐỀ CẦN GIẢI QUYẾT

Hiện tại `role` đang vô tình mô tả cùng lúc ba thứ: nghề nghiệp, mô hình kinh doanh và dịch vụ cung cấp.

Các trường hợp thực tế:

1. Photographer tự do
2. Videographer tự do
3. Makeup artist tự do, Model tự do (role đã có trong enum hiện tại)
4. Studio chỉ cho thuê địa điểm
5. Studio có đội ngũ chụp ảnh
6. Studio có đội ngũ quay video
7. Studio full-service: địa điểm + chụp + quay, tương lai thêm makeup, thiết bị...
8. Người vừa là photographer tự do vừa là chủ một studio

Chỉ dùng `Photographer | Videographer | Studio` thì không mô tả được studio nhiều dịch vụ. Nhưng tôi cũng **không** muốn đẻ thêm role kiểu `Photography Studio`, `Video Studio`, `Full-service Studio`.

---

# 2. MÔ HÌNH KHÁI NIỆM MỚI

Tách thành các khái niệm độc lập:

## 2.1. Customer / Provider — là giá trị suy ra, KHÔNG lưu thành cột

Một user là "provider" khi user đó có ít nhất một provider profile đang hoạt động. Một user là "customer" khi đặt booking. Hai điều có thể cùng đúng. **Không tạo cột `accountType`** vì nó phá pattern one-account-multi-role.

## 2.2. Provider Profile — đơn vị hiển thị, tìm kiếm và nhận booking

Mỗi provider profile:

- thuộc về một `User` (chủ sở hữu);
- có đúng một **Primary Role**;
- có một hoặc nhiều **Service**;
- là **một card** trong kết quả tìm kiếm và **tối đa một marker** trên Fmap.

Một user có thể có nhiều provider profile, nhưng tối đa một profile cho mỗi primary role. Ví dụ: Minh là photographer tự do và là chủ ABC Studio → hai profile. Người vừa chụp vừa quay tự do → **một** profile, primary role Photographer, hai service.

## 2.3. Primary Role — "Provider này về bản chất là ai?"

```text
PHOTOGRAPHER
VIDEOGRAPHER
MAKEUP_ARTIST
MODEL
STUDIO
```

Primary role quyết định: icon, marker Fmap, nhãn trên card, luồng onboarding, và tập service được phép. Không dùng primary role để biểu diễn toàn bộ dịch vụ.

Tương lai có thể thêm `RETOUCHER`, `EQUIPMENT_SHOP`, `AGENCY`. Theo quy tắc compliance, role mới mặc định là seller role và phải qua KYC.

## 2.4. Service — "Khách có thể thuê provider này làm gì?"

Phase 1:

```text
PHOTOGRAPHY
VIDEOGRAPHY
VENUE_RENTAL      (cho thuê không gian chụp/quay)
MAKEUP
MODELING
```

Tương lai: `EQUIPMENT_RENTAL`, `RETOUCH`, ...

Makeup là ví dụ quan trọng: nó vừa là service của một MUA tự do, vừa có thể là service của một studio. Search theo `MAKEUP` phải trả về cả hai.

Ma trận service được phép theo primary role (đặt trong một file config duy nhất, validate ở tầng service, không rải trong UI):

| Primary Role | Service được phép |
|---|---|
| PHOTOGRAPHER | PHOTOGRAPHY, VIDEOGRAPHY |
| VIDEOGRAPHER | VIDEOGRAPHY, PHOTOGRAPHY |
| MAKEUP_ARTIST | MAKEUP |
| MODEL | MODELING |
| STUDIO | VENUE_RENTAL, PHOTOGRAPHY, VIDEOGRAPHY, MAKEUP |

`VENUE_RENTAL` chỉ dành cho STUDIO. Hãy đánh giá lại ma trận này dựa trên codebase và đề xuất nếu cần.

**Cần đánh giá:** Service nên là Prisma enum hay bảng lookup `services`? Enum: type-safe, thêm service cần migration. Bảng: admin tự thêm được, mất type safety, dễ sinh dữ liệu rác. Tôi nghiêng về enum cho Phase 1 vì số service thay đổi chậm, nhưng hãy phân tích.

## 2.5. Hai trục "tổ chức" tách biệt — không gộp thành "Individual / Business"

**Legal Entity Type** — hình thức pháp lý, quyết định luồng KYC theo Luật TMĐT 122/2025:

```text
INDIVIDUAL           cá nhân chưa đăng ký kinh doanh → KYC bằng CCCD
HOUSEHOLD_BUSINESS   hộ kinh doanh → giấy đăng ký hộ KD + CCCD chủ hộ
COMPANY              doanh nghiệp → giấy ĐKDN + CCCD người đại diện
```

**Operating Mode** — quy mô hoạt động, chỉ để hiển thị trên card:

```text
SOLO   → "Cá nhân"
TEAM   → "Đội ngũ"
```

Hai trục này độc lập: một photographer đăng ký hộ kinh doanh vẫn có thể làm một mình (HOUSEHOLD_BUSINESS + SOLO); một cặp photographer cưới làm chung chưa đăng ký kinh doanh là (INDIVIDUAL + TEAM).

Hãy đánh giá liệu Operating Mode có đáng lưu hay nên suy ra (ví dụ STUDIO mặc định TEAM). Lưu ý studio chỉ cho thuê không gian thì không phải "đội ngũ".

## 2.6. Location — hai ngữ nghĩa khác nhau, không gộp chung

**Venue** (địa điểm cố định): chỉ STUDIO có service VENUE_RENTAL, hoặc studio có địa chỉ kinh doanh. Có `wardId`, địa chỉ, toạ độ. Trả lời câu hỏi "studio ở đâu?". Đây là địa chỉ kinh doanh, được hiển thị công khai chính xác.

**Service Area** (vùng phục vụ): freelancer và studio có ekip đi chụp ngoài. Theo pattern đã chốt là bảng nối `ProviderServiceArea` tới `Province` (tuỳ chọn tới `Ward`), nhiều vùng cho mỗi provider. Trả lời câu hỏi "provider đi được tới đâu?".

Search "Chụp ảnh tại TP.HCM" phải khớp cả hai: studio có venue ở TP.HCM **và** freelancer có service area bao gồm TP.HCM.

Tương lai: một studio nhiều chi nhánh → nhiều venue. Schema không được giả định một provider chỉ có một venue.

## 2.7. Team — chuẩn bị cho Phase 2

```text
ABC Studio (Provider Profile)
├── Services: VENUE_RENTAL, PHOTOGRAPHY, VIDEOGRAPHY
├── Venues: Chi nhánh 1 (Room A, Room B)
├── Team: Photographer A, Photographer B, Videographer C
└── Bookable Resources: Room A, Room B, Photographer A, ...
```

Phase 2 sẽ cần: thành viên team (có thể là user Fgrapher có profile riêng, hoặc chỉ là tên hiển thị), phân quyền nhiều người cùng quản lý một studio, lịch riêng của từng nhân viên.

Lưu ý compliance: hiển thị tên/ảnh nhân viên là xử lý dữ liệu cá nhân của họ → cần consent của chính nhân viên đó, không phải của chủ studio.

## 2.8. Availability — abstraction "Bookable Resource"

**Không** thiết kế `provider.available = true/false`.

Hướng đề xuất (hãy đánh giá với codebase):

- Bảng `BookableResource`: thuộc một provider profile, có `type` (Phase 1 chỉ dùng `PROVIDER_SELF`; Phase 2 thêm `ROOM`, `STAFF`, `EQUIPMENT`).
- **Ngay Phase 1, mỗi provider profile tự động có đúng một resource mặc định** khi được tạo (và được backfill cho provider cũ).
- Lịch làm việc (`AvailabilityRule`, lặp theo tuần), lịch bận thủ công (`AvailabilityBlock`), và phần giữ chỗ của booking (`BookingAllocation`) đều gắn với `resourceId`, **không** gắn trực tiếp vào provider.
- Phase 1: một provider = một resource → logic tương đương "provider có rảnh không".
- Phase 2: thêm Room A, Photographer A chỉ là thêm dòng `BookableResource`. Kiểm tra availability trở thành "mọi resource mà booking cần đều trống". **Không cần migrate dữ liệu cũ.**
- Chống double booking ở tầng database, không chỉ ở tầng code. Hãy đánh giá Postgres exclusion constraint trên `(resourceId, tstzrange(startAt, endAt))` cho các allocation đang hiệu lực, và cách đưa nó vào migration khi dùng Prisma.

Các thời điểm lưu UTC. Chuyển đổi múi giờ chỉ ở tầng hiển thị và tầng diễn giải `AvailabilityRule`.

---

# 3. ONBOARDING FLOW

## Bước 1 — Chọn primary role

```text
Bạn là ai?
○ Photographer
○ Videographer
○ Makeup artist
○ Model
○ Studio
```

## Bước 2a — Với role cá nhân (Photographer, Videographer, MUA, Model)

```text
Bạn làm việc thế nào?
○ Một mình                         → SOLO
○ Có đội ngũ nhỏ (ekip riêng)      → TEAM
```

Lựa chọn "Tôi là nhân viên của một studio" thuộc Phase 2 (team member). **Phase 1 không hiển thị lựa chọn này.** Hãy đề xuất cách xử lý (ẩn hẳn, hoặc hướng tạo profile cá nhân bình thường).

Service mặc định theo role (Photographer → PHOTOGRAPHY). Cho phép bật thêm service trong ma trận được phép ("Bạn có nhận quay video không?").

Hỏi vùng phục vụ: chọn một hoặc nhiều tỉnh/thành (từ bảng `Province`).

## Bước 2b — Với Studio

```text
Studio của bạn cung cấp dịch vụ nào?
☐ Cho thuê không gian chụp/quay
☐ Dịch vụ chụp ảnh
☐ Dịch vụ quay video
☐ Trang điểm
```

Multi-select, bắt buộc chọn ít nhất một. Danh sách render từ ma trận config, **không hardcode** giả định studio chỉ có một service.

- Có "Cho thuê không gian" → bắt buộc nhập địa chỉ venue (tỉnh → phường, địa chỉ chi tiết, vị trí trên bản đồ).
- Có dịch vụ chụp/quay đi ngoài → hỏi thêm vùng phục vụ.

## Bước 3 — Hình thức pháp lý (cho mọi provider)

```text
Bạn đã đăng ký kinh doanh chưa?
○ Chưa, tôi hoạt động cá nhân
○ Hộ kinh doanh
○ Doanh nghiệp
```

Câu trả lời quyết định giấy tờ cần nộp ở bước KYC. Profile chưa qua KYC thì không được publish và không nhận booking.

## Bước 4 — Consent

Consent tách theo mục đích (kiểm tra enum purpose hiện có). Nếu hiển thị vị trí venue trên Fmap, đánh giá có cần purpose riêng không.

---

# 4. CUSTOMER SEARCH / DISCOVERY

Nguyên tắc cốt lõi: **search theo service không đồng nghĩa search theo role.**

Khách tìm:

```text
Chụp ảnh · TP.HCM · Phường Xuân Hòa · 25/09 · 14:00–16:00
```

Kết quả gồm photographer tự do có service area TP.HCM, **và** studio có service PHOTOGRAPHY có venue hoặc service area khớp, đang có resource trống trong khung giờ đó.

UI discovery (khách không cần hiểu backend):

```text
Bạn cần gì?
📷 Chụp ảnh
🎥 Quay video
💄 Trang điểm
🏠 Thuê studio
✨ Trọn gói
```

Mỗi lựa chọn map sang service, không map sang role. Sau đó cho lọc:

- Loại provider: Cá nhân / Studio (lọc theo primary role hoặc operating mode)
- Khu vực: tỉnh, phường
- Thời gian: ngày, khung giờ
- Giá: khoảng giá từ service package

## "Trọn gói" / Full-service

**Không** lưu thành service, **không** lưu thành role. Là nhãn suy ra, định nghĩa trong **một hàm duy nhất** dùng chung cho card, filter và Fmap, ví dụ: `primaryRole = STUDIO` và có đủ `VENUE_RENTAL + PHOTOGRAPHY + VIDEOGRAPHY`. Hãy đề xuất định nghĩa và đánh giá hiệu năng khi dùng nó làm filter (có cần cột suy ra được cập nhật khi services thay đổi không).

---

# 5. PROVIDER CARD

Freelancer:

```text
Nguyễn Minh
📷 Photographer · Cá nhân · ✔ Đã xác minh
📍 Phục vụ: TP.HCM, Đồng Nai
Chân dung · Couple · Lifestyle
Từ 800k / buổi
```

Studio:

```text
ABC Studio
🏠 Studio · Đội ngũ · ✔ Đã xác minh
📍 Phường Xuân Hòa, TP.HCM
Thuê studio · 📷 Chụp ảnh · 🎥 Quay video
Thuê studio từ 300k / giờ
Gói chụp từ 1.500k
```

Một studio luôn là **một** card dù có nhiều service. Giá "Từ ..." lấy từ service package, theo từng service. Không có ngôn từ về thanh toán qua nền tảng.

---

# 6. FMAP

- Một provider profile = tối đa **một marker**. Primary role quyết định icon (📷 🎥 💄 👤 🏠).
- Studio có 3 service vẫn chỉ hiển thị một marker 🏠. Service dùng để filter, không quyết định số marker.
- Filter theo thời gian: chỉ hiển thị provider có resource trống trong khung giờ khách chọn.

## Quy tắc vị trí — bắt buộc vì dữ liệu cá nhân

- **Studio có venue**: marker tại địa chỉ kinh doanh chính xác.
- **Freelancer**: **không được** hiển thị vị trí nhà riêng. Vị trí của một cá nhân là dữ liệu cá nhân theo Luật 91/2025. Hãy đề xuất một trong các hướng: (a) không hiện freelancer trên Fmap, chỉ hiện trong danh sách; (b) hiển thị theo khu vực (vùng tỉnh/phường, không có điểm chính xác); (c) cluster theo phường. Kiểm tra xem codebase hiện có đang lưu hoặc hiển thị toạ độ chính xác của freelancer không, và báo cáo.
- Studio nhiều chi nhánh (tương lai): một marker mỗi venue, cùng trỏ về một profile. Hãy xác nhận điều này không mâu thuẫn với quy tắc "một marker mỗi provider" và đề xuất cách diễn đạt đúng.

Popup khi click:

```text
ABC Studio
🏠 Studio · Đội ngũ
Thuê studio · 📷 Chụp ảnh · 🎥 Quay video
● Có lịch trống 25/09, 14:00–16:00
[Xem hồ sơ]  [Đặt lịch]
```

---

# 7. BOOKING

- Booking thuộc về một provider profile và một customer user. Thay cho tham chiếu cặp (user, role) hiện tại — hãy xác nhận cách map từ cách làm hiện có.
- Booking có một hoặc nhiều **dòng dịch vụ** (ví dụ: VENUE_RENTAL 2 giờ + PHOTOGRAPHY gói cơ bản), mỗi dòng tham chiếu provider service hoặc service package.
- Kiểm tra availability và tạo `BookingAllocation` phải nằm **bên trong transition service** đã chốt. Hãy đề xuất allocation được tạo ở trạng thái nào (gợi ý: khi provider ACCEPTED, giải phóng khi REJECTED/CANCELLED), và cách xử lý hai khách cùng request một khung giờ.
- Không thêm trạng thái thanh toán. "Revenue split" giữa studio và nhân viên phụ thuộc vào thanh toán trên nền tảng, không thuộc MVP.

---

# 8. SEO LANDING

URL hiện tại dạng `/{role-slug}/{province-slug}`. Khi search chuyển sang theo service:

- Liệt kê mọi route landing hiện có.
- Đề xuất mapping slug → service hoặc role (ví dụ `/chup-anh/{tinh}` = service PHOTOGRAPHY, `/thue-studio/{tinh}` = VENUE_RENTAL).
- URL cũ đã index phải 301 về URL mới, không để 404.
- Ngưỡng `MIN_PROVIDERS_FOR_LANDING` phải đếm theo **cùng logic với search** (ví dụ trang chụp ảnh đếm cả freelancer lẫn studio có PHOTOGRAPHY), chỉ tính profile đã duyệt và đã KYC.

---

# 9. KYC VÀ COMPLIANCE

- KYC hiện chỉ gắn cho `MODEL`. Plan phải chuyển KYC gắn với **provider profile** (hoặc role), áp dụng cho mọi primary role.
- Luồng giấy tờ theo `legalEntityType` (mục 2.5). eKYC chỉ dùng nhà cung cấp trong nước. Không lưu ảnh CCCD gốc lâu hơn mức cần thiết.
- Trạng thái KYC chặn publish profile và nhận booking. Không primary role nào bypass được.
- Ảnh venue, ảnh portfolio đi qua cùng pipeline kiểm duyệt (`moderationStatus` mặc định `PENDING`).
- Xoá tài khoản: plan phải nói rõ điều gì xảy ra với provider profile, venue, resource, allocation và booking còn ràng buộc.

---

# 10. REVIEW CODEBASE

Không giả định database hiện tại. Kiểm tra và báo cáo cụ thể (kèm đường dẫn file):

- User / profile schema, provider schema, cách role đang được lưu và kiểm tra
- Enum, foreign key, index hiện có
- RLS policies (nếu có Supabase)
- Onboarding, provider profile, provider card
- Search, filter, Fmap, landing SEO
- Booking, availability, pricing / service package
- KYC, consent, moderation
- TypeScript types, API / query layer, frontend filters
- Có dữ liệu hoặc code nào đang dùng cấp quận/huyện không

Tìm **toàn bộ** chỗ phụ thuộc vào role, bao gồm nhưng không giới hạn:

```text
role === "photographer" / "videographer" / "studio"
RoleType.PHOTOGRAPHER ... (và mọi giá trị enum)
switch/case trên role, map role → icon/label/route
RLS policy tham chiếu role
query lọc theo role
```

Đặc biệt: navigation, profile rendering, onboarding, Fmap, filters, search queries, booking, pricing, permissions/RLS, dashboard, provider cards, landing SEO, KYC.

---

# 11. MIGRATION

## Mapping

| Role hiện tại | Legal Entity Type | Operating Mode | Primary Role | Services |
|---|---|---|---|---|
| PHOTOGRAPHER | INDIVIDUAL (tạm) | SOLO | PHOTOGRAPHER | PHOTOGRAPHY |
| VIDEOGRAPHER | INDIVIDUAL (tạm) | SOLO | VIDEOGRAPHER | VIDEOGRAPHY |
| MAKEUP_ARTIST | INDIVIDUAL (tạm) | SOLO | MAKEUP_ARTIST | MAKEUP |
| MODEL | INDIVIDUAL (tạm) | SOLO | MODEL | MODELING |
| STUDIO | **chưa xác định** | chưa xác định | STUDIO | VENUE_RENTAL (tạm) |

Các giá trị "(tạm)" và "chưa xác định" **không được coi là sự thật**:

- Legal entity type của mọi provider cũ chưa được xác nhận → đánh dấu cần xác nhận, hỏi lại khi đăng nhập hoặc ở bước KYC. Không đoán studio là COMPANY.
- Studio cũ có thể có dịch vụ chụp/quay mà dữ liệu chưa thể hiện → gán VENUE_RENTAL tạm, đánh dấu "chưa xác nhận dịch vụ", hiển thị banner yêu cầu chủ studio xác nhận. Có thể sinh gợi ý từ bio/portfolio cho admin xem, nhưng **không tự động gán service** dựa trên đoán.

## Trường hợp cần báo cáo số liệu trước khi quyết định

- User có nhiều provider role (ví dụ PHOTOGRAPHER + VIDEOGRAPHER): gộp thành một profile hai service hay giữ hai profile? Báo số lượng và đề xuất, để tôi quyết.
- Provider có dữ liệu địa chỉ/toạ độ: của studio hay của cá nhân?
- Provider thiếu dữ liệu bắt buộc theo model mới.

## Chiến lược (expand → migrate → contract)

1. Backup database. Ghi rõ lệnh và nơi lưu.
2. **Expand**: thêm bảng/cột mới, không xoá hay đổi nghĩa gì của cũ.
3. **Backfill**: script idempotent (chạy lại không tạo trùng), có chế độ dry-run in ra báo cáo số lượng theo từng nhánh mapping trước khi ghi. Tạo resource mặc định cho mọi provider cũ.
4. **Dual-read / chuyển dần**: code đọc từ model mới, có kiểm tra đối chiếu với model cũ.
5. **Contract**: chỉ xoá cột/enum cũ trong một migration **riêng**, sau khi tôi xác nhận bằng văn bản. Không nằm trong đợt đầu.

---

# 12. PHASE 1 VS TƯƠNG LAI

## Implement ngay (Phase 1)

Đủ để phục vụ: photographer/videographer/MUA/model tự do, studio cho thuê, studio có dịch vụ chụp/quay, search theo service, Fmap, booking cơ bản.

- Provider profile, primary role, services, ma trận service được phép
- Legal entity type (cho KYC), operating mode (nếu quyết định lưu)
- Venue + service area
- Bookable resource với **một resource mặc định mỗi provider**, availability rule/block, booking allocation, chống double booking ở DB
- Booking nhiều dòng dịch vụ (nếu chi phí hợp lý; nếu không, hãy đề xuất cách Phase 1 chỉ một dòng mà không khoá đường mở rộng)
- Service package và giá "Từ ..."
- KYC cho mọi primary role
- Migration dữ liệu cũ theo mục 11

## Chuẩn bị kiến trúc nhưng chưa implement

- Team management, nhân viên studio, nhiều người cùng quản lý một studio
- Nhiều phòng, nhiều chi nhánh
- Resource scheduling đa resource, lịch riêng từng nhân viên
- Package booking phức tạp (combo nhiều service với ràng buộc)
- Revenue split (phụ thuộc thanh toán)

Với mỗi mục Phase 2, nêu rõ: schema Phase 1 đã mở đường như thế nào, và Phase 2 cần thêm gì. Nếu Phase 1 **không cần tạo bảng nào** cho một mục Phase 2 thì nói thẳng, đừng tạo bảng rỗng "cho sau".

---

# 13. NGUYÊN TẮC

```text
Simple now, extensible later
```

Không over-engineer Phase 1. Nhưng không tạo kiến trúc mà 3 tháng sau phải rewrite khi thêm: MUA trong studio, Camera shop, Equipment rental, Retoucher, Team/Agency, nhiều phòng studio.

Nếu có nhiều phương án, đưa tối đa 2–3, phân tích trade-off, và đề xuất phương án hợp nhất với codebase hiện tại. Đặc biệt cần phương án cho:

- Provider profile là bảng mới, hay mở rộng `UserRole` hiện có thành profile?
- Service: enum hay bảng lookup?
- Operating mode: lưu hay suy ra?
- Freelancer trên Fmap: ẩn, vùng, hay cluster?

---

# 14. OUTPUT CẦN NỘP

## A. Current Architecture
Hệ thống hiện model role/provider thế nào; file/table/component liên quan (kèm đường dẫn); vấn đề nếu giữ nguyên. Chỉ ra mọi chỗ đang vi phạm các quyết định đã chốt ở mục 0.

## B. Target Architecture
Quan hệ giữa User, Provider Profile, Primary Role, Service, Legal Entity Type, Operating Mode, Venue, Service Area, Bookable Resource, Availability, Booking, Team (Phase 2). Kèm sơ đồ quan hệ.

## C. Database Changes
Model/bảng mới, cột mới, enum, foreign key, index (đặc biệt cho truy vấn nóng: service + tỉnh + trạng thái + khung giờ), constraint, RLS, migration.

## D. Backend / Query Changes
Query, API, service cần sửa, gồm transition service của booking và logic KYC.

## E. Frontend Changes
Onboarding, profile, provider card, search, filter, Fmap, booking UI, dashboard, landing SEO.

## F. Migration Strategy
Thứ tự migration, script backfill, báo cáo dry-run, điểm dừng chờ tôi xác nhận.

## G. Phase 1 vs Future
Như mục 12.

## H. Risks
Breaking changes; RLS; hiệu năng query (đặc biệt search có availability); dữ liệu trùng giữa provider và service; độ phức tạp availability và múi giờ; rủi ro migration; độ phức tạp UI; rủi ro compliance (vị trí freelancer, KYC theo loại chủ thể, dữ liệu nhân viên); rủi ro SEO khi đổi URL.

## I. Implementation Order
Thứ tự cụ thể dựa trên dependency thật trong codebase. Mỗi bước phải để hệ thống ở trạng thái chạy được. Tham khảo (hãy điều chỉnh):

```text
1. Schema expand
2. Backfill + dry-run report → dừng chờ xác nhận
3. Types + config ma trận service + hàm nhãn suy ra
4. Query layer đọc model mới
5. KYC theo provider profile
6. Onboarding
7. Provider profile + card
8. Search/filter + landing SEO
9. Fmap
10. Availability + booking allocation
11. Testing (gồm test double booking, test quyền, test migration)
12. Contract (xoá cũ) — chỉ sau khi tôi xác nhận
```

## J. Câu hỏi mở cho tôi
Mọi điểm bạn cần tôi quyết định trước khi code, sắp theo mức độ ảnh hưởng.

---

**Không bắt đầu code cho tới khi tôi review và approve implementation plan.**
