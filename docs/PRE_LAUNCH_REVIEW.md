# Rà soát trước khi mở — Fgrapher (Prompt B9)

Rà soát toàn bộ dự án sau các thay đổi B0–B8, thực hiện bởi 4 agent song song
(chỉ đọc, không sửa gì trong lúc rà soát) bao phủ: (1) thực thi các ràng buộc
CLAUDE.md + rò rỉ dữ liệu nhạy cảm, (2) phân quyền toàn bộ 83 file route API
(104 handler), (3) feature flag + cron job, (4) hiệu năng + nợ kỹ thuật. Mỗi
phát hiện dưới đây đã được xác minh bằng cách đọc trực tiếp code (file:line),
không suy đoán từ tài liệu.

**3 lỗ hổng NGHIÊM TRỌNG đã được vá ngay trong lúc rà soát** (xem mục đầu
tiên) — vì mức độ nguy hiểm không thể chờ đến khi hoàn tất báo cáo mới sửa.
Phần còn lại của tài liệu này giữ đúng tinh thần "chỉ báo cáo" của prompt gốc.

---

## Đã vá ngay trong lúc rà soát (không chờ)

### 1. [NGHIÊM TRỌNG] Tự cấp quyền ADMIN qua API — đã vá

`POST /api/users/roles` xác thực `roles` theo enum `Role` gốc của Prisma
(bao gồm cả `ADMIN`), và áp dụng thẳng không có allow-list. Bất kỳ người dùng
đã đăng nhập nào cũng có thể `POST {"roles":["ADMIN"]}` và ngay lập tức vượt
qua mọi kiểm tra `requireAdmin()` sau đó (đã xác nhận bằng cách đọc
`requireAdmin()` — chỉ kiểm tra có dòng `UserRole` với `role: "ADMIN",
active: true`, đúng thứ mà endpoint này để bất kỳ ai tự tạo).

**Đã sửa**: `updateRolesSchema` giờ xác thực theo `PAID_ROLE_VALUES` (6 vai
trò tự chọn được, cùng danh sách `registerSchema` đã dùng, giờ export dùng
chung thay vì bản sao thứ hai dễ lệch). Đã kiểm thử qua curl: cùng payload
giờ trả về `validation_error`, tài khoản không có role ADMIN sau đó.
Commit `788913d`.

### 2. [NGHIÊM TRỌNG] MARKETPLACE_ENABLED có thể bị bỏ qua qua API trực tiếp — đã vá

`POST /api/auth/register` và `POST /api/users/roles` không kiểm tra
`features.marketplaceEnabled` trước khi chấp nhận `"CAMERA_SHOP"` trong mảng
roles — dù toàn bộ route CRUD marketplace (`/api/products`, `/api/cart`,
`/api/orders`...) đều chặn đúng. Gọi API trực tiếp với `roles:
["CAMERA_SHOP"]` vẫn tạo được `UserRole` active + gói FREE active (qua
`assignFreePlan`, vì `BILLING_ENABLED` cũng đang tắt), rồi hồ sơ đó có thể
được publish và xuất hiện trong `/browse`/`/api/search` (không lọc theo cờ).

**Đã sửa**: cả 2 route giờ từ chối `CAMERA_SHOP` với 400 khi cờ đang tắt. Đã
kiểm thử qua curl. Commit `788913d`.

**Chưa làm (không bắt buộc nữa vì đã chặn từ gốc, nhưng nên làm cho chắc)**:
phòng thủ nhiều lớp ở `services/search.ts` (không lọc `marketplaceEnabled`
trong danh sách role mặc định) và `/api/profiles/[role]/publish` (không kiểm
tra cờ) — giờ không còn khai thác được nữa vì role không thể được tạo/kích
hoạt ngay từ đầu, nhưng vẫn là lớp phòng thủ hợp lý nếu có đường tạo role
khác trong tương lai (vd. `scripts/make-admin.ts`-style script mới, hoặc một
admin route gán role thủ công).

### 3. [CAO] Cả 3 cron route fail-open khi thiếu CRON_SECRET — đã vá

`if (process.env.CRON_SECRET && authHeader !== ...)` — khi biến môi trường
này không được set, điều kiện luôn `false` nên kiểm tra bị bỏ qua hoàn toàn,
route trở thành công khai không cần xác thực. Nghiêm trọng nhất với
`purge-kyc-documents` (xóa dữ liệu giấy tờ tùy thân).

**Đã sửa**: gộp thành `requireCronSecret()` dùng chung trong
`lib/auth-helpers.ts`, fail-**closed** ngoài `NODE_ENV=development` — thiếu
secret ở staging/production giờ bị coi là lỗi cấu hình, không phải lời mời.
Đã xác nhận cả 3 route vẫn hoạt động bình thường ở dev local (không set
`CRON_SECRET`, đúng quy trình hiện tại). Commit `788913d`.

---

## NGHIÊM TRỌNG — cần xử lý trước khi ra mắt thật

### 4. Tài khoản đăng ký qua Google OAuth bỏ qua hoàn toàn ràng buộc 18+ và ghi nhận đồng ý

Đăng ký bằng email/mật khẩu thực thi đúng ở server (`registerSchema` +
`isAtLeast18`, `src/lib/validations/auth.ts`, `src/lib/age-gate.ts`) — không
chỉ chặn ở UI. Nhưng đăng ký qua Google OAuth (`src/lib/auth.ts`, qua
`PrismaAdapter`) tạo `User` với `dateOfBirth = null` — Google chỉ cung cấp
tên/email/ảnh. Đã rà soát mọi nơi ghi `dateOfBirth` trong toàn bộ codebase:
**chỉ duy nhất** route đăng ký bằng mật khẩu ghi trường này. Không có bước
onboarding, trang cài đặt, hay route API nào cho phép bổ sung ngày sinh sau
khi đã đăng nhập qua OAuth.

**Hệ quả**: tài khoản Google OAuth có thể được tạo và dùng ở bất kỳ độ tuổi
nào, không có bất kỳ điểm thực thi nào cho ràng buộc #4 trong CLAUDE.md.
Cùng gốc rễ, tài khoản OAuth cũng **không có bất kỳ dòng `ConsentRecord`
nào** — không có bằng chứng đồng ý xử lý dữ liệu cá nhân (vi phạm ràng buộc
#6). `getAgeRangeLabel()` xử lý êm khi `dateOfBirth` null (ẩn luôn phần hiển
thị tuổi) nên lỗi này không gây crash — có lẽ vì vậy chưa bị phát hiện trước
đây.

**Việc cần làm**: thêm bước bắt buộc ngay sau lần đăng nhập OAuth đầu tiên
— thu thập ngày sinh (chặn nếu <18) và 3 checkbox đồng ý riêng biệt, trước
khi cho vào dashboard. Đây là một tính năng cần xây mới, không phải một dòng
sửa.

_Nguồn: `docs/_prelaunch-audit-compliance.md` mục 4 và 6._

---

## CAO — nên xử lý trước khi ra mắt

### 5. Vi phạm diện rộng ràng buộc #10 (tiếng Việt/VND/dd-MM-yyyy)

Hai vấn đề tách biệt:

**(a) 21 file gọi thẳng `toLocaleDateString/toLocaleTimeString/toLocaleString`**
thay vì dùng `src/lib/format.ts` (nguồn sự thật duy nhất, đã ghi rõ trong
comment đầu file). Hầu hết hardcode `"en-US"`, nhiều chỗ không set
`Asia/Ho_Chi_Minh` nên phụ thuộc múi giờ server/trình duyệt. Danh sách đầy
đủ (21 file, một số có nhiều điểm gọi) nằm trong
`docs/_prelaunch-audit-compliance.md` mục 10 — bao gồm cả
`services/bookings.ts:76` (`dateLabel`), nghĩa là rò rỉ cả vào nội dung email
xác nhận đặt lịch, không chỉ UI.

**(b) `ROLE_LABELS`/`CATEGORY_LABELS`/`EXPERIENCE_LEVEL_LABELS`
(`src/lib/constants/index.ts`) là các map tiếng Anh cứng**, không qua
next-intl — dùng ở 20 file bao gồm trang chủ, browse, hồ sơ công khai, form
đăng ký, dashboard, onboarding, quản trị. Một comment trong
`filter-sidebar.tsx` khẳng định các nhãn này "resolved via useTranslations"
— agent đã xác minh đây là comment sai, code thực tế không làm vậy.

Đây là phần việc cơ học (đổi từng lời gọi sang `formatDate`/`formatDateTime`
từ `lib/format.ts`, và route 3 map nhãn qua `next-intl`) nhưng khối lượng
lớn — khuyến nghị dành một đợt làm việc riêng, không lẫn vào các phần khác.

_Nguồn: `docs/_prelaunch-audit-compliance.md` mục 10._

### 6. Booking `contactPhone`/`locationAddress` bị lộ không nhất quán giữa các route anh em

`getBookingDetail` che đúng `contactPhone`/`locationAddress` cho đến khi
provider chấp nhận booking (đúng logic chống spam). Nhưng `listBookings` và
`listBookingsForRange` (trang lịch dashboard) dùng chung `BOOKING_INCLUDE`
— vì đây là `include` không kèm `select` ở cấp `Booking`, nên trả về **mọi**
cột scalar không lọc, bao gồm cả hai trường trên bất kể trạng thái booking.
Không lộ ra ngoài (vẫn giới hạn theo `providerId`/`customerId` của người gọi)
nhưng là một khoảng trống thật: provider xem được số điện thoại/địa chỉ của
khách qua trang danh sách/lịch dù booking còn `PENDING`, trong khi trang chi
tiết của đúng booking đó lại che đi.

**Việc cần làm**: áp cùng logic `contactInfoVisible` cho `listBookings`/
`listBookingsForRange`, hoặc bọc chung vào một hàm redaction dùng lại ở cả
3 nơi.

_Nguồn: `docs/_prelaunch-audit-compliance.md` mục "Sensitive Data Leaks" (phone, locationAddress)._

### 7. N+1 query ở danh sách hội thoại

`listConversations` (`src/services/messaging.ts:37-63`) chạy một
`db.message.count()` riêng cho từng hội thoại trong `.map()` — trang
`/dashboard/messages` được polling nên đây không phải đường hiếm dùng. Nên
gộp thành một `db.message.groupBy({ by: ["conversationId"], ... })` sau khi
đã lấy trang hội thoại, rồi join trong bộ nhớ.

_Nguồn: `docs/_prelaunch-audit-perf-debt.md` mục 1.1 Finding A._

---

## TRUNG BÌNH

### 8. Rủi ro kiến trúc: `getPublicProfileUser` không có `select` tường minh

Query dùng `include` không kèm `select` ở cấp `User` — Prisma trả về **mọi**
cột scalar, bao gồm `dateOfBirth`, `phone`, `email`, và **`passwordHash`**.
Hiện tại an toàn vì component gọi hàm này chỉ destructure đúng field cần
hiển thị, không spread nguyên object `user` vào Client Component nào — nhưng
đây không phải phòng thủ nhiều lớp thật sự, chỉ là call site hiện tại cẩn
thận. Một lần sửa sau này vô tình spread `user` vào prop của Client
Component sẽ rò rỉ cả 4 trường nhạy cảm trên ra payload trang, kể cả
`passwordHash`.

**Việc cần làm**: thêm `select` tường minh vào `getPublicProfileUser` ngay
cả khi chưa có lỗ hổng thật — đây là việc phòng ngừa rẻ, nên làm sớm.

_Nguồn: `docs/_prelaunch-audit-compliance.md` mục "Sensitive Data Leaks" (dateOfBirth)._

### 9. Ảnh giấy tờ tùy thân của hồ sơ bị từ chối không bao giờ tự xóa

`purgeAfter` chỉ được set ở nhánh **duyệt** của `reviewVerification`
(`services/admin.ts:329-347`) — nhánh từ chối chỉ set `verificationStatus:
"REJECTED"`, không set `purgeAfter`. Một xác minh bị từ chối, hoặc không bao
giờ được admin xem xét (kẹt ở `PENDING`), sẽ giữ ảnh giấy tờ (mặt trước/sau +
selfie) vĩnh viễn — trái với yêu cầu tự xóa sau 90 ngày, và đây là trường
hợp nhạy cảm hơn (giấy tờ bị từ chối/bỏ dở, không còn lý do nghiệp vụ để
tồn tại).

**Việc cần làm**: set `purgeAfter` ở cả nhánh từ chối (và cân nhắc cho cả
`PENDING` quá hạn một khoảng thời gian).

_Nguồn: `docs/_prelaunch-audit-compliance.md` mục 7._

### 10. Danh sách thành phố hardcode ở bộ lọc browse

`src/components/browse/filter-sidebar.tsx:29-38` định nghĩa cứng 8 thành
phố (`CITIES = ["Hồ Chí Minh", "Hà Nội", ...]`), dùng thật trong dropdown
lọc — không phải dead code. Vi phạm trực tiếp ràng buộc #9, và không nhất
quán với `account-basics-form.tsx` (form chỉnh hồ sơ) vốn đã dùng đúng
`Province`/`Ward` từ DB (`services/geography.ts`).

**Việc cần làm**: thay `CITIES` bằng dữ liệu thật từ `/api/geography/wards`
(hiện chỉ có TP.HCM — xem phần "Đã hoàn thành B8" bên dưới về phạm vi HCMC).

_Nguồn: `docs/_prelaunch-audit-compliance.md` mục 9._

### 11. Thiếu index cho các cột lọc thường dùng ở trang quản trị

`User.isSuspended`/`isVerified`/`deletedAt` không có `@@index` dù
`getAdminOverview` và `listUsers` lọc theo các cột này trên mỗi lần tải
dashboard admin. Vô hại với dữ liệu seed nhỏ, sẽ thành full scan khi dữ liệu
thật lớn lên.

**Việc cần làm**: thêm tối thiểu `@@index([deletedAt])`, cân nhắc thêm
`@@index([isSuspended])`.

_Nguồn: `docs/_prelaunch-audit-perf-debt.md` mục 1.2._

### 12. Logic tính giá thuê lặp lại độc lập ở 4 nơi, không có nguồn chung

Công thức `Math.max(1, Math.round((end-start)/86_400_000))` (số ngày thuê)
tồn tại độc lập ở `services/orders.ts`, `cart-utils.ts`,
`product-purchase-panel.tsx`, và `cart-item-row.tsx` (dù file này đã import
sẵn `itemLineTotal` từ `cart-utils.ts` chứa đúng công thức). Cùng kiểu, hằng
số `MIN_NOTICE_HOURS = 24` (thời hạn tối thiểu trước khi đặt/hủy lịch) được
định nghĩa độc lập 3 lần (`bookings.ts`, `availability.ts`, và hardcode trực
tiếp trong `dashboard/bookings/[id]/page.tsx`). Nếu quy tắc nghiệp vụ thay
đổi, cần sửa ở nhiều nơi và không có gì đảm bảo đồng bộ.

**Việc cần làm**: gộp thành `calculateRentalDays()` dùng chung (đề xuất
`src/lib/pricing.ts` hoặc trong `services/`), và export `MIN_NOTICE_HOURS`
từ một nơi duy nhất.

_Nguồn: `docs/_prelaunch-audit-perf-debt.md` mục 2.4._

### 13. Ảnh bìa hồ sơ công khai dùng `<img>` thô, không qua `next/image`

`profile/[username]/page.tsx:183` — trang công khai, lượt truy cập cao,
ảnh lớn nhất trong 4 vị trí dùng `<img>` thô (3 vị trí còn lại ở
dashboard/admin, ít quan trọng hơn). Đều có `eslint-disable` chủ đích, không
phải sai sót, nhưng vẫn là tối ưu còn bỏ ngỏ.

_Nguồn: `docs/_prelaunch-audit-perf-debt.md` mục 1.3._

---

## THẤP

- **`/admin` không có trong `robots.ts` disallow list** — không rò rỉ dữ
  liệu (trang vẫn yêu cầu đăng nhập) nhưng có thể bị crawl/index sự tồn tại
  của route. Sửa một dòng. (`docs/_prelaunch-audit-compliance.md` mục email/sitemap)
- **Email khách hàng hiển thị cho provider ngay từ khi booking còn PENDING**
  (khác với phone/address, không bị che) — không rõ đây là chủ đích (email
  là kênh liên hệ mức độ nhạy cảm thấp hơn) hay bỏ sót tương tự mục 6, không
  có comment giải thích như phần che phone/address có. Cần xác nhận chủ đích
  sản phẩm. (`docs/_prelaunch-audit-compliance.md` mục email)
- **Nhãn `ALTERNATIVE` trong `ProfileCategory`** — thuật ngữ hợp lệ trong
  ngành người mẫu (phong cách alt/goth) nhưng đủ mơ hồ để luật sư nên xác
  nhận không bị hiểu như một cách né ràng buộc #3. (`docs/_prelaunch-audit-compliance.md` mục 3)
- **8 chỗ tắt `react-hooks/exhaustive-deps` không có comment giải thích** —
  nhiều khả năng đều là pattern "chỉ fetch một lần khi mount" hợp lệ (khớp
  với ghi chú house-style đã có), nhưng chưa đọc từng effect để xác nhận
  không phải bug đóng gói cũ (stale closure). Danh sách đầy đủ trong
  `docs/_prelaunch-audit-perf-debt.md` mục 2.2.
- **`past-due-banner.tsx` truy vấn DB trực tiếp từ Server Component** thay
  vì gọi qua `services/subscription.ts` — vi phạm nhẹ quy ước kiến trúc, quy
  mô nhỏ, không phải bug. (`docs/_prelaunch-audit-perf-debt.md` mục 2.4 #5)
- Vài index thứ yếu đáng cân nhắc nhưng không cấp bách:
  `Message.senderId`, `Subscription.stripeCustomerId` (đang ngủ đông vì
  `BILLING_ENABLED=false`). (`docs/_prelaunch-audit-perf-debt.md` mục 1.2)

---

## THÔNG TIN — đã xác minh tốt, không cần hành động

- **Stripe/thanh toán trực tuyến**: cả 6 route liên quan Stripe và webhook
  đều chặn đúng bằng `features.billingEnabled` trước khi chạm vào
  `lib/stripe.ts`; không tìm thấy tích hợp cổng thanh toán nào khác
  (đã tìm momo/vnpay/zalopay/payos/onepay/napas — không có).
- **Gán gói thủ công qua admin**: `assignManualPlan` chỉ gọi được qua
  `requireAdmin()`, xác nhận không có đường thanh toán nào khác.
- **Không có danh mục nude/sexy/boudoir** trong `ProfileCategory` — đã đọc
  toàn bộ enum, không có mục nào thuộc loại này (trừ `ALTERNATIVE`, xem
  mục THẤP).
- **Ràng buộc 18+ cho đăng ký bằng mật khẩu**: thực thi thật ở server
  (`registerSchema.refine`), không chỉ chặn ở form UI — đã xác nhận route
  từ chối trước khi ghi DB. (Lỗ hổng OAuth nằm ở mục NGHIÊM TRỌNG #4.)
- **Xác minh danh tính bắt buộc trước khi công khai hồ sơ, mọi vai trò**:
  `setProfilePublished` là đường ghi `isPublished` duy nhất (đã xác nhận
  bằng cách tìm mọi nơi ghi cột này); agent đã chủ động thử bypass qua
  route PATCH hồ sơ chung — `isPublished` không nằm trong schema xác thực
  nên bị Zod loại bỏ âm thầm dù client cố gửi lên.
- **Đồng ý xử lý dữ liệu tách riêng từng mục đích** (cho đăng ký bằng mật
  khẩu): 3 dòng `ConsentRecord` riêng biệt mỗi lần đăng ký, ghi cả lượt từ
  chối, kèm `policyVersion`/IP/user-agent; checkbox mặc định `false`, không
  gộp chung. (Khoảng trống cho OAuth nằm ở mục NGHIÊM TRỌNG #4.)
- **Ảnh giấy tờ tùy thân**: lưu ở Cloudinary `type: "authenticated"`, không
  bao giờ có URL công khai; route xem ảnh duy nhất yêu cầu `requireAdmin()`
  và luôn ghi `AuditLog`. (Khoảng trống tự xóa nằm ở mục TRUNG BÌNH #9.)
- **Kiểm duyệt ảnh portfolio trước khi công khai**: thực thi 2 lớp —
  `setProfilePublished` yêu cầu ít nhất 1 ảnh `APPROVED`, và mọi nơi đọc
  công khai (hồ sơ, tìm kiếm) đều lọc lại `moderationStatus: APPROVED` độc
  lập, không chỉ dựa vào cờ publish.
- **Phân quyền API**: toàn bộ 83 file route (104 handler) đã được đọc đầy
  đủ. **0 route thiếu kiểm tra quyền/sở hữu** (ngoài 3 lỗ hổng đã liệt kê và
  vá ở trên). Mọi route admin gọi `requireAdmin()`; mọi route thao tác tài
  nguyên cụ thể (`[id]`) đều xác nhận người gọi là chủ sở hữu/thành viên
  liên quan ở tầng service, không chỉ dựa vào đăng nhập. Webhook Stripe xác
  minh chữ ký đúng cách (không dùng session).
- **BILLING_ENABLED và SOCIAL_FEED_ENABLED**: chặn sạch ở cả 4 đường (điều
  hướng trang, gọi API trực tiếp, link cũ trong sitemap/email, rò rỉ UI) —
  đây là 2 cờ được gate tốt nhất trong 3 cờ.
- **Cron job**: cả 3 cron (`booking-reminders`, `purge-kyc-documents`,
  `expire-bookings`) đều đăng ký đúng trong `vercel.json`, không có mục
  cron "mồ côi" (code có nhưng quên đăng ký) hay mục đăng ký "chết" (đăng ký
  nhưng không có route). Vấn đề fail-open đã vá ở trên.
- **Không dùng `any`**: rà soát toàn bộ `src/` chỉ tìm thấy "any" trong 2
  comment tiếng Anh thông thường, không có `any` TypeScript thật nào — quy
  tắc "strict mode, no any" trong CLAUDE.md đang được tuân thủ nghiêm túc.
- **TODO còn sót**: chỉ 3 mục, cả 3 đều là `TODO(i18n)` — đúng loại nợ kỹ
  thuật đã biết và có chủ đích từ đợt dịch thuật gần đây, không có bất ngờ
  nào khác (`FIXME`/`XXX`: 0 kết quả).

---

## Việc B8 đã hoàn thành trong phiên làm việc này (bối cảnh cho các phát hiện trên)

Một số phát hiện ở trên liên quan trực tiếp đến công việc B8 vừa hoàn tất
cùng phiên:

- **VIỆC 1 (dịch toàn bộ UI)**: đã merge, xác minh sạch qua quét tự động
  ~30 trang (0 key dịch bị vỡ). Phát hiện #5 ở trên (date/label tiếng Anh)
  là phần **chưa** được đợt dịch này bao phủ — cụ thể là format ngày/giờ và
  3 map nhãn (role/category/experience-level), khác với phần UI text đã
  dịch. Coi đây là việc tiếp theo của cùng nỗ lực B8 VIỆC 1, không phải lỗi
  mới.
- **VIỆC 3 (dữ liệu seed + địa giới TP.HCM)**: đã thêm bảng `Province`/`Ward`
  thật, seed đúng 168 xã/phường TP.HCM do chủ dự án cung cấp. Phát hiện #10
  ở trên (`CITIES` hardcode trong filter-sidebar) là phần UI browse **chưa**
  được nối vào hệ thống địa giới mới này — cùng gốc rễ như B4 (toàn quốc)
  vẫn đang chờ dữ liệu thật cho các tỉnh/thành ngoài TP.HCM.

---

## Phạm vi chưa xác minh hết (do các agent tự ghi nhận)

- Chưa xác minh đường ghi `ProfileMedia.moderationStatus` — ai/route nào có
  thể set `APPROVED` trực tiếp (khả năng cao chỉ admin, nhưng chưa lần theo
  từng route để xác nhận).
- Chưa rà soát toàn diện rò rỉ PII ở mọi route admin ngoài phạm vi 5 trường
  dữ liệu được yêu cầu theo dõi (phone, dateOfBirth, locationAddress, ảnh
  KYC, email).
- Chưa kiểm tra fixture/seed data hay đường render ngoài `src/app/api/**`
  (nếu có server action nào ngoài route API) cho cùng 5 trường dữ liệu trên.
- Danh sách 21 file dùng `toLocaleDateString`/`toLocaleString` (phát hiện
  #5a) được gom bằng grep và kiểm tra mẫu 3 file — không mở từng file trong
  21 file để xác nhận riêng lẻ, dù mẫu kiểm tra cho thấy pattern nhất quán
  (`"en-US"` cứng, không set `Asia/Ho_Chi_Minh`).
- 8 chỗ tắt `react-hooks/exhaustive-deps` (mục THẤP) chưa được đọc từng
  effect body để xác nhận an toàn — chỉ xác nhận có tắt và không có giải
  thích.

---

## Báo cáo gốc (chi tiết đầy đủ, theo file:line)

- `docs/_prelaunch-audit-compliance.md` — thực thi ràng buộc CLAUDE.md + rò
  rỉ dữ liệu nhạy cảm
- `docs/_prelaunch-audit-permissions.md` — phân quyền toàn bộ 83 route API
- `docs/_prelaunch-audit-flags-cron.md` — feature flag + cron job
- `docs/_prelaunch-audit-perf-debt.md` — hiệu năng + nợ kỹ thuật
