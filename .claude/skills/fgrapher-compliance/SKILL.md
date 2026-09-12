---
name: fgrapher-compliance
description: Quy tắc tuân thủ pháp lý Việt Nam bắt buộc cho Fgrapher (xác minh danh tính, dữ liệu cá nhân, consent, kiểm duyệt nội dung). BẮT BUỘC dùng skill này mỗi khi đụng tới bất kỳ thứ gì liên quan tới User, Profile, ProfileMedia, ConsentRecord, UserRole.verificationStatus, Booking, upload ảnh, đăng ký tài khoản, xoá tài khoản, xuất dữ liệu, hoặc bất kỳ migration Prisma nào chạm vào dữ liệu cá nhân — kể cả khi người dùng không nhắc tới "pháp lý", "compliance" hay "KYC". Cũng dùng khi review PR, thiết kế API mới, hoặc khi được hỏi "có cần gì thêm không" về các module trên.
---

# Fgrapher — Tuân thủ pháp lý Việt Nam

Fgrapher là sàn giao dịch TMĐT có người bán (photographer, videographer, MUA, model, studio).
Điều đó kích hoạt ba nhóm nghĩa vụ **ngay từ lần đăng ký đầu tiên**, không phải sau khi launch.

## Nguồn sự thật

Repo này **không có thư mục `docs/legal/`**. Nguồn để đối chiếu, theo thứ tự:

1. `CLAUDE.md` — mục "Phạm vi MVP & Ràng buộc bắt buộc" (10 ràng buộc, đã được chủ dự án xác nhận)
2. `docs/MVP_SCOPE.md` — phạm vi đã chốt
3. `docs/guides/fgrapher-danh-gia-va-prompt-sua-doi.md` — tài liệu gốc, các "Prompt B2/B3/B5" được trích dẫn trong comment của `schema.prisma`
4. `docs/_prelaunch-audit-compliance.md` — audit gần nhất về mảng này

**Không bịa số hiệu điều luật.** Các con số dưới đây trích từ tài liệu gốc và
**chưa được luật sư xác nhận** (CLAUDE.md nói rõ điều này). Code trong repo là
hạ tầng xây theo đặc tả kỹ thuật, không phải sự đảm bảo tuân thủ pháp luật thật.

Khung tham chiếu đang áp dụng (chưa thẩm định pháp lý):

- Luật Thương mại điện tử 122/2025 — nghĩa vụ xác minh người bán
- Luật Bảo vệ dữ liệu cá nhân 91/2025 + Nghị định 356/2025 — consent, quyền chủ thể dữ liệu
- Bộ luật Dân sự 2015 Điều 32 — quyền hình ảnh cá nhân

## Quy tắc cứng — không được vi phạm

### 1. Xác minh danh tính áp dụng cho MỌI provider role

Trạng thái xác minh nằm ở `UserRole.verificationStatus`
(`UNVERIFIED | PENDING | VERIFIED | REJECTED`) — gắn theo **cặp (user, role)**,
không gắn cứng vào `MODEL`. Đây là điều đã sửa xong, đừng "sửa lại" theo hướng cũ.

Các chốt chặn thật trong code:

- `services/public-profile.ts` → `setProfilePublished()` — **đường ghi duy nhất**
  vào `Profile.isPublished`. Không cho publish nếu `verificationStatus !== "VERIFIED"`.
  Gỡ công khai thì luôn được, kể cả chưa xác minh.
- `services/request-offers.ts` — chỉ role `VERIFIED` mới gửi được báo giá
- `services/bookings.ts` — `VERIFIED_ROLE_SELECT` dùng khi hiển thị vai trò provider

Lưu ý: comment phía trên `enum VerificationStatus` trong `schema.prisma` còn viết
"currently MODEL only" — **comment đó đã cũ**, code thật gate mọi role. Nếu có sửa
vùng đó thì sửa luôn comment.

Khi thêm role mới vào enum `Role`, mặc định coi là provider role phải xác minh,
trừ khi người dùng nói rõ ngược lại. Hỏi lại nếu không chắc.

Kiểm tra mỗi khi đụng schema:

- [ ] Trạng thái xác minh vẫn gắn theo `UserRole`, không tách bảng riêng cho một role
- [ ] Còn đường nào publish profile mà không qua `setProfilePublished()` không?
- [ ] Role mới có bị bỏ sót ở các chốt chặn trên không?

### 2. Consent phải tách theo mục đích

Một checkbox "Tôi đồng ý với Điều khoản" là **không hợp lệ**. Luật 91/2025 yêu cầu
consent riêng cho từng mục đích xử lý.

Model thật trong repo:

```prisma
model ConsentRecord {
  id            String         @id @default(cuid())
  userId        String
  purpose       ConsentPurpose
  policyVersion String
  granted       Boolean
  grantedAt     DateTime?
  revokedAt     DateTime?
  ipAddress     String?
  userAgent     String?
  createdAt     DateTime       @default(now())
}

enum ConsentPurpose {
  SERVICE               // bắt buộc để dùng dịch vụ — không bao giờ optional
  MARKETING
  ANALYTICS
  IDENTITY_VERIFICATION // riêng cho việc nộp giấy tờ tuỳ thân
}
```

Quy tắc (khớp với `services/compliance.ts`):

- **Mỗi lần grant hoặc revoke đều INSERT một dòng MỚI** — không bao giờ `update`
  dòng cũ, không bao giờ xoá. `hasConsent()` đọc dòng mới nhất của cặp
  `(userId, purpose)` để quyết định trạng thái hiện tại. Toàn bộ lịch sử phải
  dựng lại được.
- `granted` quyết định dòng đó là sự kiện grant (`grantedAt`) hay revoke
  (`revokedAt`) — không bao giờ set cả hai.
- Mỗi lần đổi chính sách → `policyVersion` mới → consent cũ không tự động kế thừa
- Không được bundle: `MARKETING`/`ANALYTICS` phải bật/tắt độc lập với `SERVICE`
- Thêm purpose mới = sửa enum + migration, **không** dùng string tự do

### 3. Tuổi tối thiểu 18 — áp dụng cho mọi vai trò

`dateOfBirth` là bắt buộc khi đăng ký, kiểm tra bằng `isAtLeast18()` trong
`src/lib/validations/auth.ts` (cả schema client và server). Không phải chỉ role
`MODEL`. Giá trị này là dữ liệu riêng tư — trang hồ sơ chỉ hiển thị **khoảng tuổi**,
không bao giờ hiện ngày sinh hay tuổi chính xác.

### 4. Ảnh có người nhận diện được cần consent riêng

Điều 32 BLDS: ảnh chân dung người khác đăng công khai cần sự đồng ý của người đó.
Với portfolio của photographer, người trong ảnh **không phải** user của Fgrapher.

Trong repo: `ProfileMedia.rightsConfirmedAt` — timestamp của checkbox xác nhận
quyền hình ảnh mà provider phải tick trước khi upload.

- Đừng bỏ checkbox đó khỏi luồng upload để "cho nhanh"
- Nếu cần chi tiết hơn (ví dụ lưu tên người trong ảnh, hay bản ghi khiếu nại
  riêng) thì đó là **model mới**, chưa có — nói rõ là chưa có thay vì giả định

### 5. ProfileMedia phải có trạng thái kiểm duyệt

Kiến trúc đã chốt là pre-publication moderation (`services/moderation.ts`):

```prisma
ProfileMedia.moderationStatus: PENDING | APPROVED | REJECTED | AUTO_REJECTED
```

- Mặc định `PENDING`. **Không bao giờ** default `APPROVED`.
- Chỉ ảnh `APPROVED` mới ra ngoài — `services/search.ts` đã chặn ở tầng query,
  và `setProfilePublished()` đòi có ít nhất 1 ảnh `APPROVED` mới cho publish
- `AUTO_REJECTED` là do bộ quét tự động; mỗi lần như vậy cộng
  `User.violationPoints` — chính sách 3 lần vi phạm trên `/guidelines` đếm bằng cột này
- Lưu `moderationNote` + `moderatedBy` + `moderatedAt` cho mọi quyết định của admin
- Không có category nội dung khoả thân / người lớn trong `ProfileCategory` — reject thẳng
- Xoá ảnh là **soft delete** (`deletedAt`), có thùng rác 7 ngày rồi cron mới purge

### 6. Giấy tờ tuỳ thân — lưu tối thiểu, tự xoá

Hiện trạng thật (xem comment dài trong `model UserRole` của `schema.prisma`):

- 3 ảnh (CMND/CCCD mặt trước, mặt sau, selfie) lưu trên **Cloudinary**, thư mục
  tách hẳn khỏi portfolio, delivery type `authenticated` —
  `lib/cloudinary.ts` → `generateKycUploadSignature()`
- Cột `*Url`/`*PublicId` **không phải URL công khai**; admin xem qua URL ký
  ngắn hạn sinh bằng `generateKycSignedUrl()`
- **Số giấy tờ không bao giờ lưu dạng plaintext** — chỉ `idNumberHash` (SHA-256),
  dùng để phát hiện trùng
- `purgeAfter` = `verifiedAt + 90 ngày`; cron `/api/cron/purge-kyc-documents` xoá ảnh
- `verificationStatus/verifiedAt/verifiedBy/idNumberHash` giữ vĩnh viễn làm audit trail
- Mọi lượt admin truy cập ghi `AuditLog` (`services/compliance.ts` → `logAudit()`)

**Lỗ hổng đang mở, phải nói ra chứ đừng che:** Cloudinary lưu ở nước ngoài. Nếu
yêu cầu "dữ liệu nhạy cảm không rời khỏi Việt Nam" là ràng buộc thật thì phần
lưu trữ ảnh giấy tờ hiện tại **chưa đạt**, và đây là quyết định hạ tầng của chủ
dự án, không phải thứ tự ý đổi trong một PR.

Chưa có nhà cung cấp eKYC nào được tích hợp — xác minh hiện là **admin duyệt tay**
qua `/admin/verifications`. Nếu sau này tích hợp eKYC, ưu tiên nhà cung cấp trong
nước (VNPT eKYC, FPT.AI) thay vì Onfido/Sumsub/Persona.

### 7. Quyền của chủ thể dữ liệu — đã có đường đi trong code

Đừng xây lại; đụng vào thì giữ nguyên hợp đồng của `services/compliance.ts`:

| Quyền               | Đường đi                                                                     |
| ------------------- | ---------------------------------------------------------------------------- |
| Xuất dữ liệu        | `/api/users/me/export` → `exportUserData()` (loại trừ `passwordHash`)        |
| Yêu cầu xoá         | `/api/users/me/deletion-request` → `requestDeletion()` → model `DataRequest` |
| Xem/rút consent     | `/api/users/me/consent` → `recordConsent()` / `revokeConsent()`              |
| Admin xử lý yêu cầu | `/api/admin/data-requests` (+ `/[id]`), `/api/admin/consent-stats`           |

`processDeletion()` **ẩn danh hoá** chứ không hard-delete `User`: xoá PII, giữ
lại booking đã hoàn thành và review để phía đối tác còn tham chiếu được; hard-delete
những gì rõ ràng là nội dung riêng của người đó (portfolio, service, tin nhắn).
Nếu thêm model mới chứa PII, **phải bổ sung vào cả `exportUserData()` và
`processDeletion()`** — quên là lỗi tuân thủ, không phải lỗi nhỏ.

## Những gì nằm sau feature flag (`src/lib/features.ts`)

Thấy code liên quan thì cảnh báo người dùng thay vì tự sửa hay xoá:

- **Stripe** — `BILLING_ENABLED` (mặc định `false`, **vĩnh viễn tắt**: Stripe không
  mở tài khoản cho doanh nghiệp đăng ký tại VN). Đừng viết thêm code Stripe.
- **MoMo / ZaloPay / chuyển khoản ngân hàng** — `MOMO_ENABLED`, `ZALOPAY_ENABLED`,
  `BANK_TRANSFER_ENABLED`, mỗi cổng một flag riêng, mặc định `false`. Code đã có
  (`services/payments.ts`, `lib/momo.ts`, `lib/zalopay.ts`, `lib/bank-transfer.ts`).
  Nghĩa là: **nói "Fgrapher không có thanh toán" là sai** — có, nhưng đang tắt.
- **Gear marketplace** — `MARKETPLACE_ENABLED` (Product/Order/Cart/checkout, role `CAMERA_SHOP`)
- **Social feed** — `SOCIAL_FEED_ENABLED` (Post/Like/Comment/Follow)
- **Giao file sản phẩm qua platform** — không có ở MVP, không có code

Khi mọi flag thanh toán đều tắt, gán gói thủ công qua `/admin/users/[id]`
(`assignManualPlan`) là phương án đang dùng.

## Cách hành xử khi bị yêu cầu làm khác

Nếu một yêu cầu mâu thuẫn với quy tắc cứng ở trên (ví dụ: "cứ để ảnh hiển thị
luôn cho nhanh, kiểm duyệt sau"), **nói rõ rủi ro trước khi làm**, nêu đúng quy
tắc nào bị vi phạm và hậu quả thực tế. Người dùng có thể quyết định ghi đè — đó
là quyền của họ — nhưng quyết định đó phải là quyết định có thông tin.

## Checklist trước khi merge bất kỳ PR nào chạm dữ liệu cá nhân

- [ ] Có `ConsentPurpose` tương ứng chưa, hay đang gộp vào `SERVICE`?
- [ ] Role mới có bị bỏ sót ở `setProfilePublished()` / các chốt `VERIFIED` không?
- [ ] Media mới có `moderationStatus` mặc định `PENDING` không?
- [ ] Model mới chứa PII đã thêm vào `exportUserData()` **và** `processDeletion()` chưa?
- [ ] Hành động admin trên dữ liệu cá nhân có gọi `logAudit()` không?
- [ ] Có ghi số giấy tờ dạng plaintext ở đâu không? (chỉ được lưu hash)
- [ ] Consent có bị `update` tại chỗ thay vì insert dòng mới không?
