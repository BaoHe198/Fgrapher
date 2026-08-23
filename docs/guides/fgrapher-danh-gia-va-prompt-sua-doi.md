# Fgrapher — Đánh giá hiện trạng & Bộ prompt sửa đổi tới MVP

**Ngày:** 23/08/2026
**Nguồn:** fgrapher-context.md (package.json, schema.prisma, cây thư mục 414 file, danh sách biến môi trường)
**Hiện trạng:** Next.js 16.3.1 / React 19 / Prisma 6 / Supabase Postgres / NextAuth v5 / Cloudinary / Stripe / next-intl. Đã có 46 page, 68 API route, 13 service, 12 file guide theo phase.

---

## PHẦN A — ĐÁNH GIÁ HIỆN TRẠNG

### A1. Những thứ làm tốt, giữ nguyên

Đây là phần tôi muốn nói trước, vì nó quyết định chiến lược sửa: **tận dụng, không viết lại**.

| Hạng mục | Nhận xét |
|---|---|
| Tách tầng service | `src/services/*` tách khỏi route handler — đúng chuẩn. Sửa nghiệp vụ chỉ cần chạm một chỗ. |
| Validation | Zod schema riêng theo domain trong `src/lib/validations/*` — dùng lại được cho mọi prompt sửa. |
| Đa ngôn ngữ | `next-intl` + `src/messages/vi.json` đã có sẵn. Không phải làm lại phần Việt hóa. |
| Kiểm thử | Playwright với 4 project (e2e / smoke / visual-light / visual-dark). Có visual regression là hiếm ở dự án giai đoạn này. |
| Kỷ luật kỹ thuật | husky + lint-staged + commitlint + `scripts/check-db-safety.mjs` chặn migrate nhầm DB. |
| Quản lý môi trường | 3 môi trường tách bạch, `src/lib/env.ts` validate lúc build, staging redirect email. |
| `UserRole` nhiều vai trò | Bảng nối có cờ `active` + `@@unique([userId, role])` — đúng hướng "một tài khoản nhiều vai trò". |
| `age-gate.ts` | Đã có kiểm tra tuổi. Cần mở rộng nhưng nền đã đúng. |
| Tính năng an toàn | `Profile.hideExactLocation`, `requireDepositBeforeContact` — người viết đã nghĩ tới an toàn của Model. Rất tốt. |
| Booking đã khá đầy đủ | Có reschedule proposal hai chiều, `cancelledBy`, `cancelReason`, `reminderSentAt` + cron nhắc lịch. |
| Comment trong schema | Giải thích lý do thiết kế, không chỉ mô tả trường. Đọc hiểu được ngay. |

### A2. Vấn đề chặn cứng — Stripe không dùng được ở Việt Nam

**Đây là vấn đề nghiêm trọng nhất, và nó không sửa được bằng code.**

Stripe không mở tài khoản merchant cho doanh nghiệp đăng ký tại Việt Nam. Vietnam nằm trong nhóm thị trường không được hỗ trợ, cùng Indonesia, Philippines, Pakistan, Nigeria. Cách duy nhất để dùng Stripe là lập pháp nhân ở nước ngoài (thường là US LLC + EIN) — nhưng nếu bạn làm vậy thì phát sinh cả một tầng vấn đề mới: dòng tiền ra nước ngoài, chuyển dữ liệu xuyên biên giới, và mâu thuẫn với nghĩa vụ đăng ký nền tảng TMĐT trong nước.

> Hãy tự kiểm tra lại tại stripe.com/global trước khi quyết định — chính sách có thể đã đổi.

Hệ quả với codebase hiện tại: **toàn bộ nhánh Stripe là code chết** — 12 biến `STRIPE_PRICE_*`, 6 API route `/api/stripe/*`, webhook handler, `src/lib/stripe.ts`, `src/services/subscription.ts`, model `Payment` + `WebhookEvent`, trang `/onboarding/billing` và `/dashboard/settings/billing`, cùng luồng `/checkout` của marketplace.

Ba hướng xử lý:

| Hướng | Ưu | Nhược |
|---|---|---|
| **A. Bỏ thanh toán tự động ở MVP, gán gói thủ công** *(khuyến nghị)* | Khớp đúng khuyến nghị "miễn phí giai đoạn đầu". Không mất gì vì bạn chưa thu tiền. Giữ nguyên code Stripe sau feature flag để dùng lại nếu sau này lập pháp nhân nước ngoài. | Phải gán gói bằng tay — nhưng với 100 provider đầu tiên thì việc này chấp nhận được. |
| B. Thay bằng cổng nội địa (VNPay / MoMo / ZaloPay / Casso) | Dùng được thật ở VN | Tốn 2–4 tuần, mà bạn chưa cần thu tiền |
| C. Lập US LLC để giữ Stripe | Giữ nguyên code | Kéo theo thuế, dòng tiền quốc tế, mâu thuẫn với đăng ký TMĐT trong nước. Không đáng ở giai đoạn này. |

### A3. Không có tầng tuân thủ pháp lý

Tôi grep toàn bộ 414 file: **không có bất kỳ file nào chứa `consent`, `audit`, `province`, `kyc`**. Nghĩa là:

| Nghĩa vụ | Hiện trạng |
|---|---|
| Đồng ý xử lý DLCN tách theo từng mục đích | ❌ Không có model `ConsentRecord` |
| Lưu bằng chứng đồng ý (thời điểm, phiên bản chính sách, IP) | ❌ Không có |
| Quyền xem / tải về / xóa dữ liệu cá nhân | ❌ Không có |
| Rút lại đồng ý theo từng mục đích | ❌ Không có |
| Nhật ký truy cập dữ liệu nhạy cảm | ❌ Không có `AuditLog` |
| Xác thực người bán trước khi cho hoạt động | ⚠️ Có hạ tầng nhưng **chỉ cho vai trò MODEL**, và comment trong schema ghi rõ luồng upload phía người dùng "deliberately NOT wired up yet" |
| Tự xóa ảnh giấy tờ sau thời hạn | ⚠️ Comment nói phải xóa sau 30 ngày, nhưng chưa có job làm việc đó |

Luật TMĐT 122/2025 yêu cầu nền tảng trung gian xác thực **mọi người bán**, không chỉ Model. Luật BVDLCN 91/2025 + NĐ 356/2025 yêu cầu đồng ý riêng từng mục đích và lưu bằng chứng. Đây là nhóm việc bắt buộc trước khi mở công khai.

### A4. Không có mô hình địa giới Việt Nam

`Profile` không có trường địa điểm nào. `User` chỉ có `location String?` + `latitude/longitude Float?`. Hệ quả:

- Không lọc được theo tỉnh/thành trong `/browse`
- Không làm được landing SEO theo tỉnh (`/photographer/ha-noi`) — mà đây là kênh khách tự nhiên quan trọng nhất
- Provider không khai báo được "phục vụ nhiều tỉnh" hay "nhận job toàn quốc"
- `travelWilling` hiện chỉ là cờ boolean trên Profile, không gắn với vùng nào

Vì bạn muốn mở toàn quốc, đây là hạng mục phải làm, không phải tùy chọn.

### A5. Phạm vi đã phình vượt MVP

Hai mảng lớn đã được xây đầy đủ nhưng nằm ngoài phạm vi MVP:

**Marketplace bán/cho thuê gear** — `Product`, `ProductImage`, `Order`, `OrderItem`, `CartItem`, `DepositStatus`, cùng các trang `/shop`, `/cart`, `/checkout`, `/dashboard/orders`, `/dashboard/shop-orders`, `/dashboard/listings` và ~12 API route. Đây là mảng tôi đã cảnh báo ở mục 12.3 của tài liệu phân tích: bán hàng hóa kéo theo nghĩa vụ TMĐT nặng hơn nhiều (xuất xứ hàng hóa, đổi trả, bảo hành, thuế), cộng tồn kho và vận chuyển.

**Mạng xã hội** — `Post`, `PostMedia`, `Like`, `Comment`, `Follow`. Đây là mảng "đừng cố thành Instagram".

**Khuyến nghị: ẩn sau feature flag, KHÔNG xóa.** Xóa thì phí công đã bỏ ra; để nguyên thì gánh chi phí bảo trì, chi phí kiểm duyệt, và rủi ro pháp lý ngay từ ngày mở. Feature flag cho phép bật lại trong 5 phút khi bạn sẵn sàng.

Ghi chú thêm: `CAMERA_SHOP` đã nằm trong enum `Role` và đã có `STRIPE_PRICE_CAMERA_SHOP_*` — nghĩa là vai trò "để sau" này đã được xây thành vai trò chính thức.

### A6. Lỗ hổng kiểm duyệt nội dung

`ProfileMedia` **không có trường trạng thái kiểm duyệt**. Ảnh upload lên là hiển thị công khai ngay. Với một nền tảng nhiếp ảnh ở Việt Nam, đây là rủi ro trực tiếp: một provider đăng ảnh vi phạm là nền tảng chịu trách nhiệm, và bạn không có cơ chế nào chặn trước.

Có `Report` + `ReportPriority` + `AdminAction` — tốt, nhưng đó là xử lý **sau khi** nội dung đã công khai. Cần thêm hàng rào **trước khi** công khai.

Điểm tốt: `ProfileCategory` không có nhãn nude/boudoir/sexy. Giữ nguyên như vậy.

### A7. Booking — sửa bổ sung, không cần viết lại

`Booking` dùng `customerId` / `providerId` cứng. Đúng như tôi lo ở tài liệu phân tích, nhưng **may mắn là không chặn**: photographer đi thuê MUA vẫn chạy được với vai trò `customer`. Thiếu bốn thứ, đều thêm được bằng migration bổ sung:

- `parentBookingId` — để gắn đơn thuê ekip vào đơn khách hàng
- `requesterRole` / `recipientRole` — để biết đơn này thuộc luồng nào, phục vụ thống kê và hiển thị
- `BookingStatus.EXPIRED` — hiện chưa có, đơn PENDING treo vô hạn
- `BookingStatusHistory` — hiện không truy vết được ai đổi trạng thái lúc nào, cần cho xử lý tranh chấp

Ngoài ra `startTime`/`endTime` đang là `String` ("10:00") — chấp nhận được, nhưng cần cẩn thận khi tính toán trùng lịch.

### A8. Dữ liệu đặt ngoài Việt Nam

Supabase (nhiều khả năng region Singapore), Cloudinary, Resend đều ở nước ngoài. Theo NĐ 356/2025, việc này kích hoạt nghĩa vụ về chuyển dữ liệu cá nhân xuyên biên giới — cần lập hồ sơ, không phải cấm. Đây là việc pháp lý, không phải việc code, nhưng cần đưa vào danh sách và hỏi luật sư.

### A9. Tổng hợp mức ưu tiên

| # | Việc | Mức | Ước lượng |
|---|---|---|---|
| 1 | Vô hiệu hóa Stripe, chuyển sang gán gói thủ công | **Chặn cứng** | 1–2 ngày |
| 2 | Thêm tầng tuân thủ (Consent, AuditLog, export/delete) | **Bắt buộc pháp lý** | 4–6 ngày |
| 3 | Mở rộng KYC cho mọi vai trò provider + job xóa ảnh giấy tờ | **Bắt buộc pháp lý** | 3–5 ngày |
| 4 | Thêm mô hình địa giới VN + lọc theo tỉnh + landing SEO | **Cốt lõi sản phẩm** | 4–6 ngày |
| 5 | Thêm kiểm duyệt ảnh trước khi công khai | **Rủi ro cao** | 2–3 ngày |
| 6 | Feature flag ẩn marketplace + social feed | **Thu hẹp phạm vi** | 1–2 ngày |
| 7 | Bổ sung Booking: parentBookingId, EXPIRED, StatusHistory | Hoàn thiện | 2–3 ngày |
| 8 | Việt hóa toàn bộ + đổi dữ liệu mẫu sang VN | Hoàn thiện | 2–3 ngày |

**Tổng: khoảng 4–6 tuần.** Không cần viết lại dự án.

---

## PHẦN B — BỘ PROMPT SỬA ĐỔI

**Cách dùng:** chạy đúng thứ tự. Mỗi prompt một phiên Claude Code riêng. Sau mỗi prompt, chạy `pnpm test:e2e` và tự review diff trước khi sang bước sau.

**Trước khi bắt đầu:** tạo nhánh mới `git checkout -b mvp-scope`, và **backup database** (bạn chưa có user thật nên rủi ro thấp, nhưng vẫn nên làm).

---

### PROMPT B0 — Tạo CLAUDE.md làm ràng buộc chung

```
Dự án Fgrapher hiện tại đã chạy được. Tôi vừa hoàn thành phân tích yêu cầu và cần thu hẹp phạm vi lại đúng MVP, đồng thời bổ sung các nghĩa vụ pháp lý bắt buộc tại Việt Nam.

Nhiệm vụ phiên này: KHÔNG sửa code tính năng. Chỉ đọc dự án và tạo tài liệu ràng buộc.

VIỆC 1 — Đọc và hiểu dự án hiện tại:
- prisma/schema.prisma
- docs/ARCHITECTURE.md, docs/FEATURES.md
- src/services/*, src/lib/*
Tóm tắt cho tôi trong 20 dòng: kiến trúc hiện tại, các module chính, chỗ nào business logic bị lọt ra ngoài tầng service.

VIỆC 2 — Tạo file CLAUDE.md ở thư mục gốc với nội dung sau:

=== BỐI CẢNH ===
Fgrapher là nền tảng TMĐT trung gian kết nối khách hàng với nhà cung cấp dịch vụ nhiếp ảnh. Thị trường: TOÀN QUỐC Việt Nam. Chưa có người dùng thật. Đang thu hẹp phạm vi về MVP.

=== TRONG PHẠM VI MVP ===
Vai trò: CUSTOMER, PHOTOGRAPHER, VIDEOGRAPHER, MAKEUP_ARTIST, MODEL, STUDIO, ADMIN
Tính năng: hồ sơ + portfolio, tìm kiếm toàn quốc theo tỉnh, lịch + đặt lịch, nhắn tin, đánh giá, thông báo, quản trị, tuân thủ dữ liệu cá nhân

=== NGOÀI PHẠM VI MVP (ẩn sau feature flag, KHÔNG xóa code) ===
- CAMERA_SHOP và toàn bộ marketplace bán/cho thuê gear (Product, Order, Cart, checkout, shop)
- Mạng xã hội (Post, Like, Comment, Follow)
- Mọi thanh toán trực tuyến, kể cả thuê bao
- Giao ảnh/video cho khách qua nền tảng

=== RÀNG BUỘC BẮT BUỘC ===
1. Stripe KHÔNG dùng được: Stripe không mở tài khoản cho doanh nghiệp đăng ký tại Việt Nam. Không viết thêm code Stripe. Code Stripe hiện có giữ lại nhưng vô hiệu hóa sau feature flag.
2. Không tích hợp bất kỳ cổng thanh toán nào ở giai đoạn này. Gói thuê bao gán thủ công qua trang admin.
3. KHÔNG có danh mục hoặc nhãn nội dung nude/sexy/boudoir. Không thêm vào ProfileCategory. Đây là yêu cầu pháp lý.
4. Mọi tài khoản phải từ 18 tuổi. Áp dụng cho MỌI vai trò, không riêng MODEL.
5. Provider PHẢI qua xác minh danh tính trước khi hồ sơ được công khai — áp dụng cho MỌI vai trò provider, không riêng MODEL. Đây là nghĩa vụ theo Luật Thương mại điện tử 122/2025 (nền tảng trung gian phải xác thực người bán).
6. Đồng ý xử lý dữ liệu cá nhân phải tách riêng từng mục đích, lưu bằng chứng có timestamp + phiên bản chính sách + IP. Cấm checkbox gộp, cấm tick sẵn. Theo Luật BVDLCN 91/2025 và Nghị định 356/2025.
7. Ảnh giấy tờ tùy thân lưu ở thư mục riêng không công khai, mọi lượt truy cập ghi AuditLog, tự xóa sau 90 ngày.
8. Ảnh portfolio phải qua kiểm duyệt trước khi hiển thị công khai.
9. Không hardcode danh sách tỉnh/thành trong code hay component.
10. Toàn bộ giao diện tiếng Việt. Tiền VND định dạng "1.500.000₫". Ngày dd/MM/yyyy. Múi giờ Asia/Ho_Chi_Minh.

=== NGUYÊN TẮC SỬA CODE ===
- Ưu tiên TẬN DỤNG code hiện có. Chỉ đề xuất viết lại module khi thực sự cần, và phải giải thích lý do trước khi làm.
- Business logic nằm ở src/services/*, không lọt vào route handler hay component.
- Mọi input validate bằng Zod trong src/lib/validations/*.
- Mọi migration phải reversible, đặt tên rõ nghĩa.
- Không dùng `any`. Không tắt lint rule.
- Sau mỗi thay đổi schema, cập nhật docs/ tương ứng.

VIỆC 3 — Tạo docs/MVP_SCOPE.md liệt kê chi tiết: file nào thuộc phạm vi MVP, file nào sẽ bị feature-flag, file nào là code chết cần đánh dấu.

Làm xong 3 việc, dừng lại báo cáo. Chưa sửa code.
```

---

### PROMPT B1 — Vô hiệu hóa Stripe, chuyển sang gán gói thủ công

```
Đọc CLAUDE.md trước.

Stripe không dùng được vì doanh nghiệp đăng ký tại Việt Nam không mở được tài khoản Stripe. Cần vô hiệu hóa toàn bộ luồng thanh toán nhưng GIỮ LẠI code để dùng sau nếu đổi chiến lược.

VIỆC 1 — Tạo hệ thống feature flag:
Tạo src/lib/features.ts đọc từ biến môi trường, với các cờ:
  BILLING_ENABLED (mặc định false)
  MARKETPLACE_ENABLED (mặc định false)
  SOCIAL_FEED_ENABLED (mặc định false)
Kiểu dữ liệu chặt chẽ, validate trong src/lib/env.ts. Ghi rõ trong .env.example.

VIỆC 2 — Đưa Stripe sau cờ BILLING_ENABLED:
- 6 route /api/stripe/* và /api/webhooks/stripe: khi cờ tắt, trả 404 ngay ở đầu handler (không phải 500, không lộ thông tin)
- Trang /onboarding/billing: khi cờ tắt, bỏ qua bước này, chuyển thẳng sang bước tiếp theo của onboarding
- Trang /dashboard/settings/billing: khi cờ tắt, hiện trang thông báo "Hiện tại Fgrapher đang miễn phí cho toàn bộ nhà cung cấp dịch vụ" thay vì UI thanh toán
- Chuyển 12 biến STRIPE_* thành optional trong src/lib/env.ts, không fail khi thiếu

VIỆC 3 — Gán gói thủ công:
- Giữ nguyên model Subscription và SubscriptionStatus
- Bỏ qua stripeCustomerId/stripeSubscriptionId khi cờ tắt
- Thêm vào trang admin /admin/users/[id]: khu vực quản lý thuê bao — chọn gói, đặt ngày hết hạn, ghi chú lý do, nút lưu
- Mọi thao tác gán gói ghi vào AdminAction
- Mặc định: mọi provider mới đăng ký được gán gói FREE, hạn 12 tháng
- Cập nhật src/lib/constants/plans.ts: thêm gói FREE, ghi rõ giai đoạn khởi động miễn phí

VIỆC 4 — Cập nhật trang /pricing:
Hiển thị bảng giá các gói NHƯNG kèm băng-rôn rõ ràng: "Miễn phí toàn bộ trong giai đoạn khởi động. Chúng tôi sẽ thông báo trước ít nhất 30 ngày trước khi bắt đầu thu phí." Nút CTA đổi thành "Đăng ký miễn phí".

VIỆC 5 — Đánh dấu code chết:
Thêm comment đầu mỗi file Stripe: lý do vô hiệu hóa, điều kiện để bật lại. Cập nhật docs/FEATURES.md.

KHÔNG xóa file nào. KHÔNG xóa model Payment/WebhookEvent. Chỉ vô hiệu hóa.

Chạy pnpm build và pnpm test:e2e để chắc chắn không vỡ gì.
```

---

### PROMPT B2 — Tầng tuân thủ dữ liệu cá nhân

```
Đọc CLAUDE.md trước.

Bổ sung tầng tuân thủ Luật Bảo vệ dữ liệu cá nhân 91/2025 và Nghị định 356/2025. Hiện dự án chưa có gì cho phần này. Đây là nghĩa vụ bắt buộc trước khi mở công khai.

VIỆC 1 — Thêm model vào schema:

model ConsentRecord {
  id, userId, purpose (enum ConsentPurpose), policyVersion,
  granted Boolean, grantedAt, revokedAt, ipAddress, userAgent, createdAt
  @@index([userId, purpose])
}
enum ConsentPurpose { SERVICE, MARKETING, ANALYTICS }
  // SERVICE là bắt buộc để dùng dịch vụ. MARKETING và ANALYTICS là tùy chọn.

model AuditLog {
  id, actorId, action (String), targetType, targetId,
  metadata Json?, ipAddress, userAgent, createdAt
  @@index([actorId, createdAt]) @@index([targetType, targetId])
}

model DataRequest {
  id, userId, type (enum: EXPORT | DELETION), status (PENDING|PROCESSING|COMPLETED|REJECTED),
  requestedAt, completedAt, resultUrl, note
}

Viết migration reversible.

VIỆC 2 — Service tuân thủ:
Tạo src/services/compliance.ts với:
- recordConsent(userId, purpose, granted, req) — luôn tạo bản ghi MỚI, không update bản cũ, để giữ lịch sử đầy đủ
- revokeConsent(userId, purpose)
- hasConsent(userId, purpose) — trả boolean
- logAudit(actorId, action, targetType, targetId, metadata, req)
- exportUserData(userId) — gom toàn bộ dữ liệu cá nhân thành JSON
- requestDeletion(userId) / processDeletion(userId)

Quy tắc xóa tài khoản: ẩn danh hóa thay vì xóa cứng những bản ghi cần giữ cho bên còn lại (booking đã hoàn thành, đánh giá đã viết) — thay tên thành "Người dùng đã xóa", xóa email/phone/avatar/dateOfBirth, giữ lại id. Xóa cứng: media, tin nhắn, hồ sơ. Ghi AuditLog toàn bộ quá trình.

VIỆC 3 — Sửa luồng đăng ký (src/app/(auth)/register + /api/auth/register):
Thay checkbox điều khoản hiện tại bằng 3 checkbox RIÊNG BIỆT, KHÔNG tick sẵn:
  [ ] Tôi đồng ý cho Fgrapher xử lý dữ liệu cá nhân của tôi để cung cấp dịch vụ (bắt buộc)
  [ ] Tôi đồng ý nhận thông tin khuyến mại, tin tức qua email (tùy chọn)
  [ ] Tôi đồng ý cho Fgrapher phân tích hành vi sử dụng để cải thiện dịch vụ (tùy chọn)
Mỗi checkbox tạo một ConsentRecord riêng kèm policyVersion, IP, user agent.
Hai checkbox tùy chọn KHÔNG được chặn đăng ký.
Đặt hằng số CURRENT_POLICY_VERSION trong src/lib/constants.

VIỆC 4 — Trang "Dữ liệu của tôi" tại /dashboard/settings/data:
- Xem tóm tắt dữ liệu Fgrapher đang lưu về mình, nhóm theo loại
- Bảng trạng thái từng đồng ý, có nút bật/tắt riêng cho MARKETING và ANALYTICS
- Nút "Tải về dữ liệu của tôi" → sinh file JSON
- Nút "Xóa tài khoản" → xác nhận 2 bước, giải thích rõ cái gì bị xóa cái gì được giữ, tạo DataRequest
- Link tới Chính sách bảo vệ dữ liệu cá nhân

VIỆC 5 — Áp dụng ConsentPurpose.MARKETING:
Trong src/lib/email.ts và src/services/notification.ts: trước khi gửi bất kỳ email marketing nào, kiểm tra hasConsent(userId, MARKETING). Email giao dịch (xác nhận đơn, nhắc lịch, đặt lại mật khẩu) KHÔNG cần đồng ý marketing — phân loại rõ hai nhóm này trong code.

VIỆC 6 — Trang admin /admin/compliance:
- Danh sách DataRequest kèm hạn xử lý
- Tra cứu AuditLog, lọc theo người thực hiện / hành động / khoảng thời gian
- Thống kê ConsentRecord theo mục đích

Viết test Playwright: đăng ký tạo đúng 3 ConsentRecord; tắt MARKETING thì không nhận email marketing; export trả về JSON đầy đủ.
```

---

### PROMPT B3 — Mở rộng KYC cho mọi vai trò provider

```
Đọc CLAUDE.md trước.

Hiện tại UserRole đã có sẵn hạ tầng verification (verificationStatus, verificationIdUrl, verifiedAt, verifiedBy, verificationRejectedReason) nhưng theo comment trong schema thì luồng upload phía người dùng CHƯA được nối, và chỉ dùng cho vai trò MODEL.

Theo Luật Thương mại điện tử 122/2025, nền tảng trung gian phải xác thực MỌI người bán trước khi cho phép hoạt động. Cần mở rộng ra tất cả vai trò provider.

VIỆC 1 — Bổ sung schema:
Thêm vào UserRole: verificationIdBackUrl, verificationIdBackPublicId, verificationSelfieUrl, verificationSelfiePublicId, idNumberHash (String? — chỉ lưu hash SHA-256 của số CCCD để phát hiện trùng, TUYỆT ĐỐI không lưu plain text), purgeAfter DateTime?
Thêm index cho hàng đợi duyệt: @@index([verificationStatus, createdAt])

VIỆC 2 — Luồng upload phía provider:
Trang mới /onboarding/verification, hoặc thêm bước vào onboarding hiện có:
- Upload CCCD mặt trước, mặt sau, ảnh selfie cầm CCCD
- Nhập họ tên đầy đủ và số CCCD (số CCCD chỉ dùng để hash rồi vứt, KHÔNG lưu)
- Giải thích rõ cho người dùng: vì sao cần, ai được xem, lưu bao lâu, khi nào bị xóa
- Checkbox đồng ý riêng cho việc xử lý giấy tờ tùy thân, tạo ConsentRecord
- Sau khi gửi: trạng thái PENDING, hiển thị tiến trình rõ ràng
- Bị từ chối: hiện lý do, cho nộp lại

VIỆC 3 — Bảo mật ảnh giấy tờ (bắt buộc, không được đơn giản hóa):
- Upload vào folder Cloudinary RIÊNG, type "private" hoặc "authenticated", TÁCH HOÀN TOÀN khỏi folder ảnh portfolio
- Không bao giờ trả URL công khai. Chỉ sinh signed URL hạn 5 phút, chỉ cấp cho ADMIN
- MỌI lượt sinh signed URL ghi AuditLog: action "VIEW_KYC_DOCUMENT", targetId là userId của người bị xem, kèm IP
- Sửa src/lib/cloudinary.ts để tách hai luồng upload này rõ ràng, đặt tên hàm khác nhau để không gọi nhầm

VIỆC 4 — Ràng buộc nghiệp vụ:
- Profile.isPublished chỉ được đặt true khi UserRole.verificationStatus === VERIFIED
- Kiểm tra ở TẦNG SERVICE (src/services/public-profile.ts), không chỉ ở UI
- Hồ sơ chưa xác minh: không hiện trong /browse, không hiện trong /api/search, không nhận được booking
- Provider VẪN được tạo portfolio ở chế độ nháp trong lúc chờ duyệt — quan trọng để giảm tỉ lệ bỏ cuộc
- Hiển thị huy hiệu "Đã xác minh" trên hồ sơ công khai và trong trang chi tiết đơn

VIỆC 5 — Mở rộng age gate:
src/lib/age-gate.ts hiện chỉ áp cho MODEL. Đổi thành áp cho MỌI vai trò, kiểm tra ở /api/auth/register. dateOfBirth chuyển thành bắt buộc khi đăng ký. Dưới 18 tuổi: từ chối kèm thông báo lịch sự, rõ ràng.

VIỆC 6 — Hoàn thiện trang admin /admin/verifications:
- Hàng đợi sắp theo thời gian nộp, hiện thời gian chờ
- Xem 3 ảnh qua signed URL, đối chiếu với thông tin khai
- Nút Duyệt / Từ chối, lý do từ chối bắt buộc, chọn từ danh sách có sẵn + ô ghi chú
- Khi duyệt: đặt verifiedAt, verifiedBy, purgeAfter = now + 90 ngày

VIỆC 7 — Cron job xóa ảnh giấy tờ:
Tạo /api/cron/purge-kyc-documents, chạy hàng ngày:
- Tìm UserRole có purgeAfter < now và verificationIdUrl khác null
- Xóa ảnh khỏi Cloudinary, set các trường URL về null
- Giữ lại verificationStatus, verifiedAt, verifiedBy, idNumberHash
- Ghi AuditLog cho mỗi lần xóa
Đăng ký trong vercel.json. Bảo vệ bằng CRON_SECRET như các cron hiện có.

Viết test: hồ sơ chưa VERIFIED không xuất hiện trong search; mọi lần xem ảnh KYC đều tạo AuditLog; purge job xóa đúng và giữ đúng.
```

---

### PROMPT B4 — Địa giới hành chính Việt Nam & tìm kiếm toàn quốc

```
Đọc CLAUDE.md trước.

Hiện dự án không có mô hình địa giới. Profile không có trường địa điểm, User chỉ có location String? và lat/lng. Cần thêm để hỗ trợ tìm kiếm toàn quốc và landing SEO theo tỉnh.

LƯU Ý QUAN TRỌNG: Việt Nam đã sáp nhập đơn vị hành chính năm 2025 — hiện còn 34 đơn vị cấp tỉnh (không phải 63), và đã bỏ cấp huyện, chỉ còn tỉnh → xã/phường. TÔI SẼ CUNG CẤP danh sách chính thức. Đừng tự sinh danh sách từ trí nhớ. Hãy tạo file seed rỗng có cấu trúc sẵn và báo tôi điền vào.

VIỆC 1 — Schema:
model Province {
  code String @id, name String, nameEn String?, type (TINH | THANH_PHO_TRUNG_UONG),
  slug String @unique, sortOrder Int
  profiles ProfileServiceArea[]
}
model Ward {
  code String @id, name String, provinceCode String, slug String
  @@index([provinceCode])
}
model ProfileServiceArea {
  profileId, provinceCode, isPrimary Boolean @default(false)
  @@id([profileId, provinceCode])
}
Thêm vào Profile: provinceCode String? (nơi đặt trụ sở/chỗ ở chính), wardCode String?, servesNationwide Boolean @default(false)
Thêm vào Booking: provinceCode String?

Ghi chú: Profile.travelWilling đã có sẵn — làm rõ khác biệt với servesNationwide trong comment, hoặc gộp lại nếu trùng nghĩa.

VIỆC 2 — Seed:
Tạo prisma/seeds/provinces.ts với cấu trúc sẵn sàng nhưng mảng dữ liệu để trống, kèm comment hướng dẫn tôi điền. Ghi rõ trong comment: dữ liệu sau sáp nhập 2025, cần đối chiếu nguồn chính thức, ngày cập nhật cuối.

VIỆC 3 — Onboarding & sửa hồ sơ:
- Bước chọn khu vực: chọn tỉnh chính (bắt buộc), chọn thêm nhiều tỉnh phục vụ (tùy chọn), toggle "Nhận job toàn quốc"
- Component chọn tỉnh phải có ô tìm nhanh vì danh sách dài
- Studio bắt buộc có địa chỉ cụ thể + tỉnh + phường

VIỆC 4 — Sửa src/services/search.ts và /browse:
Thêm bộ lọc tỉnh (chọn nhiều), mặc định "Toàn quốc".

XỬ LÝ MẬT ĐỘ KHÔNG ĐỀU — phần này quan trọng, đừng bỏ qua:
- Provider có servesNationwide = true xuất hiện trong kết quả MỌI tỉnh, kèm nhãn rõ "Nhận job toàn quốc"
- Nếu người dùng đã chọn tỉnh và kết quả chính < 5, hiện THÊM section riêng biệt bên dưới: "Nhà cung cấp nhận job toàn quốc". KHÔNG trộn lẫn vào kết quả chính, phải có tiêu đề section rõ ràng.
- Trạng thái rỗng: thông báo tử tế, gợi ý bỏ bớt bộ lọc, kèm ô "Thông báo cho tôi khi có nhà cung cấp ở khu vực này" (lưu vào bảng WaitlistEntry mới: email, provinceCode, role, createdAt)
- Bộ lọc đồng bộ vào URL query để chia sẻ link được

VIỆC 5 — Landing SEO theo tỉnh:
Route mới /[roleSlug]/[provinceSlug] — ví dụ /photographer/ha-noi, /studio/da-nang
- generateStaticParams cho các tổ hợp vai trò × tỉnh
- Metadata riêng từng trang: title, description, Open Graph
- JSON-LD schema.org
- Nội dung: danh sách provider trong tỉnh + đoạn giới thiệu ngắn về thị trường tỉnh đó
- Cập nhật sitemap.xml và robots.txt
Đây là kênh khách tự nhiên quan trọng nhất của dự án — người Việt hay search "chụp ảnh cưới + tên tỉnh".

VIỆC 6 — Index database cho tổ hợp lọc phổ biến: (role, isPublished, provinceCode), (provinceCode, priceMin).

Viết test: provider nationwide hiện ở mọi tỉnh; section "toàn quốc" tách riêng khi kết quả ít; landing SEO render đúng metadata.
```

---

### PROMPT B5 — Kiểm duyệt ảnh trước khi công khai

```
Đọc CLAUDE.md trước.

Hiện ProfileMedia không có trạng thái kiểm duyệt — ảnh upload lên là công khai ngay. Với nền tảng nhiếp ảnh tại Việt Nam đây là rủi ro pháp lý trực tiếp. Cần thêm hàng rào trước khi công khai.

VIỆC 1 — Schema:
Thêm vào ProfileMedia:
  moderationStatus (enum: PENDING | APPROVED | REJECTED | AUTO_REJECTED) @default(PENDING)
  moderationNote String?
  moderatedBy String?
  moderatedAt DateTime?
  rightsConfirmedAt DateTime?   // xác nhận có quyền sử dụng ảnh
  @@index([moderationStatus, createdAt])
Migration: đặt toàn bộ ảnh hiện có thành APPROVED để không vỡ dữ liệu sẵn có.

VIỆC 2 — Xác nhận quyền sử dụng ảnh (bắt buộc):
Trước khi upload, hiện checkbox KHÔNG tick sẵn:
"Tôi xác nhận mình có quyền sử dụng những ảnh này và đã được sự đồng ý của người xuất hiện trong ảnh."
Không tick thì không cho upload. Lưu thời điểm vào rightsConfirmedAt.
Lý do (ghi vào comment code): theo Điều 32 Bộ luật Dân sự 2015, việc sử dụng hình ảnh cá nhân phải được người đó đồng ý.

VIỆC 3 — Xử lý ảnh khi upload (sửa src/lib/cloudinary.ts):
- XÓA EXIF, đặc biệt là toạ độ GPS. Đây là dữ liệu cá nhân, giữ lại vừa vi phạm vừa nguy hiểm cho an toàn của Model.
- Tạo các biến thể: thumbnail 400px, medium 1200px, large 2000px
- Chuyển WebP
- Giới hạn số ảnh theo gói, đọc từ src/lib/constants/plans.ts

VIỆC 4 — Lớp quét nội dung nhạy cảm:
Tạo src/services/moderation.ts với interface trừu tượng ContentScanner.
Cài đặt mặc định: MockScanner luôn trả PENDING (đưa vào hàng đợi duyệt tay).
Thiết kế sao cho sau này thay bằng Cloudinary AI Moderation hoặc dịch vụ khác chỉ cần đổi một chỗ.
Nếu scanner trả về phát hiện nội dung khỏa thân/khiêu dâm: đặt AUTO_REJECTED, ghi ModerationAction, cộng điểm vi phạm cho tài khoản.

VIỆC 5 — Ràng buộc hiển thị:
Ở TẦNG SERVICE (src/services/public-profile.ts, search.ts): chỉ trả ảnh moderationStatus === APPROVED cho người xem công khai.
Provider tự xem được ảnh PENDING của mình, có nhãn "Đang chờ duyệt".
Profile không có ảnh APPROVED nào thì không được isPublished.

VIỆC 6 — Trang admin /admin/moderation:
- Lưới ảnh chờ duyệt, xem lớn được
- Phím tắt: A duyệt, R từ chối, mũi tên chuyển ảnh
- Duyệt hàng loạt
- Từ chối kèm lý do chọn từ danh sách có sẵn + ô ghi chú
- Cảnh báo ảnh chờ quá 24h (SLA mục tiêu)
- Ghi ModerationAction + AuditLog cho mọi thao tác

VIỆC 7 — Cập nhật /guidelines (Tiêu chuẩn cộng đồng):
Viết bằng tiếng Việt, ghi rõ: không chấp nhận ảnh khỏa thân, ảnh khiêu dâm, ảnh phô bày cơ thể mang tính gợi dục; tài khoản phải từ 18 tuổi; quy trình 3 lần vi phạm khóa tài khoản; cách khiếu nại khi bị từ chối.

Viết test: ảnh PENDING không lộ qua API công khai; upload không tick xác nhận quyền thì bị chặn; EXIF bị xóa sau upload.
```

---

### PROMPT B6 — Thu hẹp phạm vi: ẩn marketplace & social feed

```
Đọc CLAUDE.md trước.

Marketplace bán/cho thuê gear và mạng xã hội nằm ngoài phạm vi MVP. Cần ẩn sau feature flag để giảm bề mặt rủi ro và chi phí vận hành, NHƯNG KHÔNG XÓA CODE.

VIỆC 1 — Ẩn marketplace sau MARKETPLACE_ENABLED:
Khi cờ tắt:
- Các trang /shop, /shop/[productId], /cart, /checkout, /checkout/success → trả notFound()
- /dashboard/listings, /dashboard/listings/new, /dashboard/listings/[id]/edit, /dashboard/orders, /dashboard/orders/[id], /dashboard/shop-orders → trả notFound()
- Các API route products, shop-products, cart, orders → trả 404 ở đầu handler
- Ẩn mọi link tới các trang này khỏi navigation, footer, dashboard sidebar
- Vai trò CAMERA_SHOP: ẩn khỏi danh sách chọn vai trò khi đăng ký và khỏi bộ lọc /browse. GIỮ trong enum Role để không vỡ dữ liệu.

VIỆC 2 — Ẩn social feed sau SOCIAL_FEED_ENABLED:
- Ẩn UI đăng bài, like, comment, follow khỏi mọi trang
- API tương ứng trả 404
- Giữ nguyên model Post/Like/Comment/Follow trong schema

VIỆC 3 — Rà soát rò rỉ:
Grep toàn bộ codebase tìm mọi chỗ còn tham chiếu tới các tính năng đã ẩn: navigation, sitemap, metadata, email template, notification type, seed data, test. Xử lý từng chỗ.
Đặc biệt kiểm tra NotificationType enum — có loại nào thuộc marketplace/social không, nếu có thì không phát sinh nữa.

VIỆC 4 — Cập nhật tài liệu:
docs/FEATURES.md: đánh dấu rõ tính năng nào đang bật, tính năng nào đang ẩn và vì sao.
README.md: hướng dẫn bật lại từng cờ.

VIỆC 5 — Dọn navigation:
Rà lại toàn bộ menu, footer, dashboard sidebar sau khi ẩn — đảm bảo không còn link chết, không còn menu rỗng, bố cục không bị vỡ.

Chạy pnpm build và toàn bộ test. Sửa mọi test đang phụ thuộc vào tính năng đã ẩn — cho skip có điều kiện theo cờ, đừng xóa test.
```

---

### PROMPT B7 — Hoàn thiện Booking

```
Đọc CLAUDE.md trước.

Booking hiện đã khá đầy đủ (reschedule hai chiều, cancel reason, cron nhắc lịch). Cần bổ sung 4 thứ.

VIỆC 1 — Đơn thuê ekip:
Thêm vào Booking: parentBookingId String? (self-relation), requesterRole Role, recipientRole Role
Photographer/Videographer khi đặt lịch MUA/Model/Studio có tùy chọn "Gắn vào đơn khách hàng" → chọn từ danh sách đơn ACCEPTED của mình.

QUY TẮC QUAN TRỌNG: khi đơn cha bị hủy, đơn con KHÔNG tự động hủy. Chỉ gửi thông báo cho photographer để họ tự quyết định. Lý do (ghi vào comment): MUA/Model đã giữ chỗ, hủy tự động khiến họ mất job oan.

Trong trang chi tiết đơn, hiển thị quan hệ cha-con nếu có.

VIỆC 2 — Trạng thái EXPIRED:
Thêm EXPIRED vào enum BookingStatus. Thêm trường expiresAt DateTime?
Khi tạo đơn: expiresAt = createdAt + 48 giờ.
Tạo cron /api/cron/expire-bookings chạy mỗi giờ, chuyển PENDING quá hạn sang EXPIRED, gửi thông báo cho cả hai bên. Đăng ký trong vercel.json.

VIỆC 3 — BookingStatusHistory:
model BookingStatusHistory {
  id, bookingId, fromStatus, toStatus, actorId, note, createdAt
  @@index([bookingId, createdAt])
}
Sửa src/services/bookings.ts: gom TOÀN BỘ logic đổi trạng thái vào một hàm duy nhất transitionBooking(bookingId, toStatus, actorId, note) — hàm này kiểm tra bước chuyển có hợp lệ không, kiểm tra actor có quyền không, thực hiện, rồi ghi history. Mọi nơi khác gọi qua hàm này, không tự update status.

Bảng bước chuyển hợp lệ:
PENDING → CONFIRMED | DECLINED | EXPIRED | CANCELLED
CONFIRMED → COMPLETED | CANCELLED | NO_SHOW
COMPLETED → (kết thúc)
Các trạng thái còn lại là trạng thái cuối.

VIỆC 4 — Chống spam & an toàn:
- Một người tối đa 5 đơn PENDING cùng lúc, kiểm tra ở tầng service
- Booking.provinceCode: lấy từ Profile của provider hoặc từ form
- Không hiển thị contactPhone/locationAddress cho tới khi đơn CONFIRMED (hiện đã có requireDepositBeforeContact — mở rộng logic này thành mặc định theo trạng thái đơn, không phụ thuộc depositPaid vì không có thanh toán)
- Trang chi tiết đơn hiển thị rõ đối phương đã xác minh danh tính hay chưa
- Với đơn đầu tiên giữa hai người chưa từng làm việc với nhau: hiện hộp gợi ý an toàn ngắn gọn (chọn địa điểm công cộng cho buổi gặp đầu, báo người thân lịch trình)

Viết test Playwright đầy đủ cho transitionBooking: mọi bước chuyển hợp lệ, mọi bước bị cấm, kiểm tra phân quyền, tự hết hạn.
```

---

### PROMPT B8 — Việt hóa & dữ liệu mẫu

```
Đọc CLAUDE.md trước.

VIỆC 1 — Rà soát i18n:
Dự án đã có next-intl với src/messages/vi.json và en.json. Hãy:
- Grep toàn bộ src/ tìm chuỗi tiếng Anh hardcode chưa qua hệ thống dịch
- Đưa hết vào vi.json, dịch sang tiếng Việt tự nhiên (không dịch máy cứng nhắc)
- Đặt vi làm locale mặc định trong src/i18n/routing.ts
- Kiểm tra kỹ: email template, thông báo lỗi, tên trạng thái đơn, nhãn enum, metadata SEO

VIỆC 2 — Định dạng theo chuẩn Việt Nam:
Tạo src/lib/format.ts:
- formatVND(amount) → "1.500.000₫"
- formatDate(date) → dd/MM/yyyy
- formatDateTime(date) → HH:mm dd/MM/yyyy
Múi giờ Asia/Ho_Chi_Minh cho mọi hiển thị. Rà soát mọi chỗ đang dùng date-fns và toLocaleString, thay bằng các hàm này.

VIỆC 3 — Thay dữ liệu seed:
prisma/seed.ts hiện có dữ liệu mẫu nước ngoài (tên kiểu Philippines, giá USD). Thay bằng:
- Tên người Việt thật (Nguyễn Minh Anh, Trần Quốc Hùng, Lê Thị Mai Hương...)
- Địa điểm dùng provinceCode thật từ bảng Province
- Giá VND theo mặt bằng thị trường Việt Nam: photographer 1,5–8 triệu/buổi, MUA 500k–2 triệu/look, studio 200k–800k/giờ, model 800k–3 triệu/buổi
- Mô tả, tên album, tên gói dịch vụ bằng tiếng Việt
- Ảnh mẫu: dùng ảnh placeholder trung tính, KHÔNG lấy ảnh có bản quyền từ internet

VIỆC 4 — Nội dung trang tĩnh:
Viết lại bằng tiếng Việt: /about, /help, /contact.
Riêng /terms, /privacy, /guidelines, và trang mới /platform-rules (Quy chế hoạt động nền tảng): tạo KHUNG với các mục cần có và ghi chú "nội dung chờ luật sư soạn". ĐỪNG tự viết nội dung pháp lý rồi để dùng thật.

VIỆC 5 — Cập nhật visual regression snapshot sau khi đổi ngôn ngữ:
pnpm test:visual:update
```

---

### PROMPT B9 — Rà soát trước khi mở

```
Đọc CLAUDE.md. Rà soát toàn bộ dự án sau các thay đổi B0–B8 và báo cáo. CHƯA SỬA GÌ, chỉ báo cáo.

1. TUÂN THỦ RÀNG BUỘC: với từng ràng buộc trong CLAUDE.md, chỉ ra nó được thực thi ở đâu. Đặc biệt tìm chỗ chỉ chặn ở UI mà tầng service/API vẫn cho qua — đây là lỗi hay gặp nhất.

2. PHÂN QUYỀN: liệt kê toàn bộ API route (khoảng 68 route), với mỗi route ghi: ai được gọi, kiểm tra quyền ở đâu. Chỉ ra route nào thiếu kiểm tra.

3. RÒ RỈ DỮ LIỆU NHẠY CẢM: truy vết mọi nơi trả về phone, dateOfBirth, locationAddress, ảnh KYC, email. Xác nhận không lọt qua API công khai, không lọt vào JSON-LD hay metadata SEO.

4. FEATURE FLAG: xác nhận khi tắt cờ thì không còn đường nào truy cập được tính năng — kể cả gọi API trực tiếp, kể cả link cũ trong sitemap hay email đã gửi.

5. CRON: liệt kê mọi cron job, xác nhận đã đăng ký trong vercel.json và có bảo vệ CRON_SECRET.

6. HIỆU NĂNG: chỉ ra truy vấn N+1, trang thiếu index, ảnh chưa tối ưu.

7. NỢ KỸ THUẬT: chỗ dùng `any`, chỗ tắt lint, TODO còn sót, business logic lọt vào component.

Viết vào docs/PRE_LAUNCH_REVIEW.md, sắp theo mức nghiêm trọng.
```

---

## PHẦN C — VIỆC BẠN CẦN TỰ LÀM

Những việc này Claude Code không làm thay được:

| # | Việc | Vì sao |
|---|---|---|
| 1 | **Quyết định hướng xử lý Stripe** (A2) | Quyết định kinh doanh, không phải kỹ thuật |
| 2 | **Lấy danh sách 34 tỉnh/thành chính thức** | Cần nguồn chính thống, không để AI tự sinh |
| 3 | Thành lập doanh nghiệp | Điều kiện tiên quyết để đăng ký nền tảng TMĐT |
| 4 | Đăng ký nền tảng TMĐT tại online.gov.vn | Phải xong trước khi mở công khai |
| 5 | Thuê luật sư soạn Điều khoản, Chính sách DLCN, Quy chế hoạt động | Không để AI viết nội dung pháp lý dùng thật |
| 6 | Lập hồ sơ đánh giá tác động xử lý DLCN (DPIA) | Nghĩa vụ theo NĐ 356/2025 |
| 7 | Chỉ định nhân sự bảo vệ dữ liệu cá nhân | NĐ 356/2025 yêu cầu điều kiện năng lực cụ thể |
| 8 | Hỏi luật sư về dữ liệu đặt tại Supabase/Cloudinary (A8) | Nghĩa vụ chuyển dữ liệu xuyên biên giới |
| 9 | Quyết định ai làm kiểm duyệt ảnh và trực xử lý báo cáo | Chi phí vận hành thường xuyên |

---

*Đánh giá dựa trên fgrapher-context.md, không phải trên toàn bộ source code. Một số nhận định về hành vi runtime (ví dụ luồng nào đang chạy thật, luồng nào chỉ là UI) là suy luận từ cấu trúc file và schema — cần bạn xác nhận lại. Phần pháp lý cần luật sư xác nhận.*
