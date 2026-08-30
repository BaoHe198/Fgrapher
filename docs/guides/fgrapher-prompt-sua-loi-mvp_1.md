# Fgrapher — Bộ prompt sửa lỗi sau MVP

**Ngày:** 29/08/2026
**Nguồn:** file Excel "Các lỗi cần sửa" (10 mục + 11 ảnh nhúng), site đang chạy tại fgrapher.vercel.app, và context dự án đã phân tích trước đó.

---

## PHẦN A — DANH SÁCH LỖI

### A1. Lỗi bạn đã liệt kê

| # | Mô tả | Mức | Nhận định sau khi xem ảnh |
|---|---|---|---|
| L01 | Đổi favicon thành logo Fgrapher | Thấp | Rõ ràng, không có gì phải bàn |
| L02 | Xóa 2 tab "Studio" và "Bảng giá" khỏi header | Thấp | Hợp lý — "Studio" trùng chức năng với bộ lọc trong Tìm kiếm; "Bảng giá" thì mâu thuẫn với chính sách miễn phí giai đoạn đầu |
| L03 | Đổi "Khám phá" → "Tìm kiếm" | Thấp | Đúng. "Tìm kiếm" là điều người dùng thực sự làm |
| L04 | Message: bỏ tab riêng, chuyển thành popup toàn cục | Trung bình | Đúng hướng. Hiện đang là icon ở header dẫn sang trang riêng |
| L05 | Bỏ section "Bán tác phẩm của bạn ở nơi khách hàng đang tìm" | Trung bình | **Bắt buộc bỏ**, không chỉ vì thẩm mỹ — xem A2 |
| L06 | `/dashboard/profile` trả 404 | **Cao** | Xác nhận qua ảnh. Trang hồ sơ thật nằm ở `/dashboard/settings/profile` |
| L07 | Quản trị viên chưa có chức năng duyệt ảnh | **Chặn cứng** | Xem A3 — đây là lỗi nghiêm trọng nhất |
| L08 | Lịch làm việc: thêm chặn lịch bận thủ công | Cao | Đúng nhu cầu thật. Tin tốt: API đã có sẵn, chỉ thiếu UI — xem A4 |
| L09 | UI: text sát viền, shape đè lên nhau | Trung bình | Xác nhận ở nhiều chỗ — xem A5 |
| L10 | Share profile không đính link khi sang mạng xã hội | Trung bình | Xem A6 — có thể là lỗi giả do test trên localhost |

### A2. Lỗi tôi phát hiện thêm

| # | Mô tả | Mức |
|---|---|---|
| L11 | **Admin không có lối vào khu quản trị.** Ảnh dashboard của tài khoản admin cho thấy sidebar y hệt người dùng thường: Tổng quan, Lịch đặt, Portfolio, Đã lưu, Tin nhắn, Cài đặt. Không có mục nào dẫn tới `/admin`. Các trang admin đã tồn tại nhưng không ai vào được trừ khi gõ URL tay. | **Chặn cứng** |
| L12 | **Admin bị gán gói thuê bao.** Ảnh cho thấy "Gói hiện tại: Pro — Quản trị viên" và thanh "Hoàn thiện hồ sơ 40%" trên tài khoản admin. Comment trong schema ghi rõ ADMIN không cần subscription. Logic gán gói đang áp cả cho admin. | Trung bình |
| L13 | **Rò rỉ tiếng Anh diện rộng dù đã chọn VI.** Trang 404 ("Page not found", "Go home", "Browse artists"), tab hồ sơ ("Portfolio", "Services", "Reviews"), trạng thái "Available", widget đặt lịch ("Book Mai Hương", "From 1.200.000₫ per session", "Select a service", "Select a date", "Book now"), trạng thái rỗng ("No portfolio items yet"), menu chia sẻ ("Copy link", "Share to Facebook"), sidebar ("Portfolio"). | **Cao** |
| L14 | **Metadata trang chủ vẫn tiếng Anh.** `<title>` là "Fgrapher — Find your artist", meta description cũng tiếng Anh. Đây là thứ hiện trên Google — ảnh hưởng trực tiếp tới SEO, kênh khách quan trọng nhất. | **Cao** |
| L15 | **Lịch bắt đầu từ thứ Bảy** ở widget đặt lịch trên trang hồ sơ (Thứ 7, CN, Thứ 2...), trong khi trang Lịch làm việc lại bắt đầu từ Chủ nhật. Vừa sai quy ước Việt Nam, vừa không nhất quán giữa hai màn hình. | Trung bình |
| L16 | **Trang chủ quảng bá tính năng ngoài phạm vi MVP.** Meta description và hero vẫn nhắc "cửa hàng máy ảnh" (đã ẩn sau feature flag), "thanh toán ở một nơi" (không có thanh toán), "nhận file ảnh cuối cùng qua Fgrapher" (không có giao file). Đây là quảng cáo sai sự thật về tính năng — Luật TMĐT 122/2025 cấm gây nhầm lẫn về công dụng dịch vụ. | **Cao** |
| L17 | **Cam kết "Nghệ sĩ xác nhận trong vòng 24 giờ".** Bạn không kiểm soát được điều này. Hệ thống đặt `expiresAt = 48 giờ`. Nên sửa cho khớp hoặc bỏ hẳn cam kết. | Trung bình |
| L18 | **Dropdown thông báo đè lên thẻ thống kê** và cắt ngang dòng chào "Chào buổi sáng, Thị Ngọc Anh". Thuộc nhóm L09 nhưng là lỗi z-index/positioning cụ thể. | Trung bình |

### A3. Vì sao L07 là lỗi chặn cứng

Ảnh trang Portfolio cho thấy **cả 8 ảnh đều mang nhãn "Đang chờ duyệt"**. Nghĩa là:

- Cơ chế kiểm duyệt phía provider đã chạy đúng (ảnh mới lên là `PENDING`)
- Nhưng **không có màn hình admin nào để duyệt chúng**
- Ảnh sẽ kẹt ở `PENDING` vĩnh viễn
- Mà theo ràng buộc đã đặt: profile không có ảnh `APPROVED` thì không được công khai

**Hệ quả dây chuyền: không một provider nào có thể xuất hiện trên nền tảng.** Toàn bộ marketplace đứng yên. Cộng với L11 (admin không có lối vào), hiện tại bạn không có cách nào vận hành nền tảng qua giao diện.

Đây là việc phải sửa trước tiên.

### A4. Về L08 — API đã có sẵn

Trong cây thư mục dự án đã có `/api/blocked-dates/route.ts`, `/api/blocked-dates/[id]/route.ts`, và schema có model `BlockedDate`. Nghĩa là **backend đã xong**, chỉ thiếu phần giao diện trên trang `/dashboard/calendar` để provider bấm vào ngày và đánh dấu bận.

Đây là tin tốt: việc này chỉ mất khoảng nửa ngày, không phải xây từ đầu.

Nhu cầu bạn nêu rất đúng và quan trọng hơn bạn nghĩ: provider nhận job từ Facebook, Zalo, khách quen. Nếu Fgrapher cho khách đặt trúng ngày họ đã bận ở kênh khác, provider sẽ phải từ chối — và tỉ lệ từ chối cao sẽ giết niềm tin vào nền tảng ngay từ những đơn đầu tiên.

### A5. Về L09 — các chỗ lỗi cụ thể tìm thấy

Từ ảnh trang hồ sơ:
- Avatar tràn qua ranh giới ảnh bìa, và hàng badge ("Chuyên viên trang điểm", "Available", đánh giá) bị ép sát ngay cạnh avatar ở đúng mép ảnh bìa
- Dòng địa chỉ nằm chồng lên vùng chuyển tiếp giữa ảnh bìa và nền
- Vùng ảnh bìa là khối màu trơn cao bất thường, không có ảnh — trạng thái rỗng chưa được xử lý

Từ ảnh dashboard:
- Dropdown thông báo đè lên thẻ "Nghệ sĩ đã lưu" và cắt ngang tiêu đề chào

### A6. Về L10 — nhiều khả năng là lỗi giả

Ảnh cho thấy hộp thoại "Create post" của Facebook mở ra hoàn toàn trống, không có link, không có preview.

Ba nguyên nhân có thể, cần kiểm tra theo thứ tự:

1. **Bạn đang test trên `localhost:3000`.** Facebook và X không thể truy cập localhost để đọc thẻ Open Graph. Kể cả code đúng 100%, kết quả vẫn sẽ trống. **Hãy test lại trên fgrapher.vercel.app trước khi sửa gì.**
2. Thiếu tham số `u` trong URL sharer của Facebook
3. Trang hồ sơ thiếu thẻ Open Graph, hoặc có nhưng thiếu `og:image`

Ngoài ra, một nhận xét về thị trường: menu chia sẻ hiện có Facebook, X, WhatsApp. **Ở Việt Nam, X và WhatsApp gần như không ai dùng.** Nên thay bằng **Zalo** — đây mới là kênh chia sẻ chính của người Việt.

### A7. Thứ tự xử lý đề xuất

| Đợt | Nội dung | Ước lượng |
|---|---|---|
| **1 — Chặn cứng** | L07, L11, L06, L12 | 1–2 ngày |
| **2 — Điều hướng & nội dung** | L01, L02, L03, L05, L14, L16, L17 | 1 ngày |
| **3 — Lịch** | L08, L15 | 1 ngày |
| **4 — Tin nhắn** | L04 | 1–2 ngày |
| **5 — Việt hóa** | L13 | 1 ngày |
| **6 — Giao diện** | L09, L18 | 1–2 ngày |
| **7 — Chia sẻ** | L10 | nửa ngày |

---

## PHẦN B — BỘ PROMPT

Chạy theo thứ tự. Mỗi prompt một phiên riêng. Sau mỗi prompt chạy `pnpm build` và `pnpm test:e2e`.

---

### PROMPT F1 — Mở khóa khu quản trị (ưu tiên cao nhất)

```
Đọc CLAUDE.md và docs/MVP_SCOPE.md trước.

Đang có lỗi chặn cứng toàn bộ nền tảng: ảnh portfolio upload lên là PENDING, nhưng không có màn hình admin nào để duyệt. Profile không có ảnh APPROVED thì không được công khai, nên hiện KHÔNG provider nào có thể xuất hiện trên nền tảng. Cộng thêm việc tài khoản admin không có lối vào khu /admin trong giao diện.

VIỆC 1 — Lối vào khu quản trị:
Tài khoản có UserRole role=ADMIN hiện đang thấy sidebar y hệt người dùng thường (Tổng quan, Lịch đặt, Portfolio, Đã lưu, Tin nhắn, Cài đặt). Cần:
- Thêm mục "Quản trị" vào sidebar dashboard, CHỈ hiện với vai trò ADMIN
- Submenu: Tổng quan, Duyệt hồ sơ (KYC), Duyệt hình ảnh, Báo cáo vi phạm, Người dùng, Tuân thủ dữ liệu
- Kiểm tra quyền ở tầng server, không chỉ ẩn ở UI: middleware chặn mọi route /admin/* nếu không phải ADMIN, trả 404 (không phải 403, để không lộ sự tồn tại của khu vực này)
- Rà soát toàn bộ trang /admin/* hiện có, đảm bảo trang nào cũng gọi cùng một helper kiểm tra quyền

VIỆC 2 — Màn hình duyệt hình ảnh /admin/moderation:
Đây là phần đang thiếu hoàn toàn. Cần:
- Lưới ảnh có moderationStatus = PENDING, sắp theo thời gian upload cũ nhất trước
- Mỗi ảnh hiện: ảnh lớn xem được, tên provider, vai trò, tên album, thời gian upload, thời gian đã chờ
- Cảnh báo màu với ảnh chờ quá 24 giờ
- Nút Duyệt / Từ chối trên từng ảnh
- Từ chối bắt buộc chọn lý do từ danh sách có sẵn: "Ảnh không liên quan đến dịch vụ", "Chất lượng quá thấp", "Nghi ngờ vi phạm bản quyền", "Vi phạm tiêu chuẩn cộng đồng", "Khác" + ô ghi chú
- Duyệt hàng loạt: chọn nhiều ảnh, duyệt một lần
- Phím tắt: A = duyệt, R = từ chối, mũi tên trái/phải chuyển ảnh
- Bộ lọc theo vai trò provider
- Mọi thao tác ghi ModerationAction và AuditLog

VIỆC 3 — Thông báo cho provider:
Khi ảnh được duyệt hoặc bị từ chối, gửi thông báo in-app + email cho provider. Nếu bị từ chối, ghi rõ lý do và hướng dẫn cách sửa.

VIỆC 4 — Sửa lỗi admin bị gán gói thuê bao:
Ảnh cho thấy tài khoản admin hiện "Gói hiện tại: Pro — Quản trị viên" và thanh "Hoàn thiện hồ sơ 40%". Theo comment trong schema, ADMIN không cần subscription. Cần:
- Không tạo/gán Subscription cho vai trò ADMIN
- Ẩn thẻ "Gói hiện tại" và thanh "Hoàn thiện hồ sơ" khỏi dashboard admin
- Rà soát mọi chỗ giả định "user luôn có subscription" và xử lý trường hợp admin

VIỆC 5 — Sửa 404 tại /dashboard/profile:
Đường dẫn /dashboard/profile đang trả "Page not found". Trang hồ sơ thật nằm ở /dashboard/settings/profile.
- Tìm mọi nơi trong code đang trỏ tới /dashboard/profile và sửa lại
- Thêm redirect vĩnh viễn từ /dashboard/profile sang /dashboard/settings/profile để không vỡ link cũ
- Grep toàn bộ codebase tìm các đường dẫn dashboard khác cũng bị lệch tương tự, báo cáo cho tôi danh sách

Viết test Playwright: tài khoản không phải admin truy cập /admin/* nhận 404; duyệt ảnh chuyển đúng trạng thái và tạo AuditLog; ảnh APPROVED hiện được trên hồ sơ công khai.
```

---

### PROMPT F2 — Điều hướng, thương hiệu và nội dung trang chủ

```
Đọc CLAUDE.md trước.

VIỆC 1 — Favicon:
Thay favicon mặc định của Next.js bằng logo Fgrapher (biểu tượng khung vuông lồng nhau đang dùng ở header).
- Tạo đủ bộ: favicon.ico, icon.svg, apple-icon.png, và các kích thước cho PWA manifest
- Đặt trong src/app/ theo quy ước file-based metadata của Next.js
- Kiểm tra hiển thị đúng ở cả nền sáng và nền tối

VIỆC 2 — Dọn thanh điều hướng:
Header hiện có: Khám phá | Studio | Bảng giá
- XÓA "Studio" (đã có bộ lọc vai trò trong trang tìm kiếm, trùng chức năng)
- XÓA "Bảng giá" (mâu thuẫn với chính sách miễn phí giai đoạn đầu)
- ĐỔI TÊN "Khám phá" thành "Tìm kiếm"
- Rà soát footer và mọi nơi khác còn dùng nhãn "Khám phá", thống nhất lại
- Giữ trang /pricing tồn tại (truy cập trực tiếp được) nhưng bỏ khỏi navigation chính

VIỆC 3 — Bỏ section CTA trên trang chủ:
Xóa hẳn khối "Bán tác phẩm của bạn ở nơi khách hàng đang tìm" cùng dòng phụ "Vai trò nhà cung cấp từ 390.000₫/tháng. Khách hàng duyệt và đặt lịch miễn phí." và nút "Trở thành nhà cung cấp".
Lý do: đang trong giai đoạn miễn phí, hiển thị giá 390.000₫/tháng là sai thông tin.
Thay bằng một CTA trung tính hơn: mời trở thành nhà cung cấp, nhấn mạnh MIỄN PHÍ trong giai đoạn đầu, không nêu giá.

VIỆC 4 — Sửa nội dung quảng bá sai phạm vi:
Trang chủ hiện đang quảng bá những tính năng KHÔNG tồn tại trong MVP. Đây không chỉ là lỗi nội dung — Luật Thương mại điện tử 122/2025 cấm nền tảng gây nhầm lẫn về công dụng dịch vụ.

Cần sửa:
- Meta description và hero còn nhắc "cửa hàng máy ảnh" / "camera shops" → BỎ, vai trò này đã ẩn sau feature flag
- "tìm kiếm, đặt lịch và thanh toán ở một nơi" → BỎ chữ "thanh toán", không có thanh toán trên nền tảng
- Bước 3 "Tận hưởng buổi chụp": "nhận file ảnh cuối cùng qua Fgrapher" → BỎ, không có tính năng giao file
- "Nghệ sĩ xác nhận trong vòng 24 giờ" → đổi thành "trong vòng 48 giờ" cho khớp với expiresAt của booking, hoặc đổi thành mô tả trung tính không cam kết thời gian

Sau khi sửa, grep toàn bộ src/messages/*.json và các trang tĩnh tìm mọi nhắc tới: thanh toán, camera shop, cửa hàng máy ảnh, giao file, gear, thuê thiết bị. Báo cáo danh sách cho tôi.

VIỆC 5 — Metadata SEO tiếng Việt:
Trang chủ hiện có <title>Fgrapher — Find your artist</title> và meta description tiếng Anh. Đây là thứ hiển thị trên Google.
- Chuyển toàn bộ metadata sang tiếng Việt, đưa vào hệ thống next-intl
- Viết title/description riêng cho từng trang chính: trang chủ, /browse, /profile/[username], các trang landing theo tỉnh
- Kiểm tra Open Graph và Twitter card cũng dùng tiếng Việt
- Đặt lang="vi" trên thẻ html khi locale là vi

VIỆC 6 — Kiểm tra link chết:
Footer đang có /careers và /support. Kiểm tra hai trang này có tồn tại không (cây thư mục dự án chỉ thấy /help và /contact). Nếu không tồn tại thì hoặc tạo trang, hoặc bỏ link. Rà soát toàn bộ link trong footer và navigation, báo cáo link nào 404.
```

---

### PROMPT F3 — Chặn lịch bận thủ công

```
Đọc CLAUDE.md trước.

Nhà cung cấp dịch vụ nhận job từ nhiều kênh (Facebook, Zalo, khách quen), không chỉ từ Fgrapher. Họ cần đánh dấu ngày bận để khách không đặt trúng. Nếu thiếu, provider sẽ phải từ chối nhiều đơn, và tỉ lệ từ chối cao sẽ phá niềm tin vào nền tảng.

LƯU Ý QUAN TRỌNG: backend đã có sẵn. Model BlockedDate đã tồn tại trong schema, và đã có /api/blocked-dates/route.ts + /api/blocked-dates/[id]/route.ts. Hãy ĐỌC code hiện có trước, chỉ bổ sung phần còn thiếu, KHÔNG viết lại API.

VIỆC 1 — Kiểm tra backend hiện có:
Đọc model BlockedDate và hai API route. Báo cáo cho tôi: hỗ trợ chặn cả ngày hay theo khung giờ, có hỗ trợ chặn khoảng nhiều ngày liên tiếp không, có trường lý do không. Nếu thiếu thì bổ sung schema (migration reversible).

VIỆC 2 — Giao diện trên /dashboard/calendar:
Trang lịch hiện chỉ hiển thị booking, không tương tác được. Cần thêm:
- Bấm vào một ô ngày → mở popup với các lựa chọn:
  * "Chặn cả ngày"
  * "Chặn khung giờ" → chọn giờ bắt đầu/kết thúc
  * "Chặn nhiều ngày" → chọn khoảng ngày
  * Ô ghi chú lý do (tùy chọn, chỉ provider thấy, không hiện cho khách)
- Kéo chọn nhiều ngày liền nhau để chặn hàng loạt
- Ngày đã chặn hiển thị khác biệt rõ ràng (nền gạch chéo hoặc màu xám), có nhãn "Bận"
- Bấm vào ngày đã chặn → tùy chọn bỏ chặn
- KHÔNG cho chặn ngày đã có booking ở trạng thái CONFIRMED — hiện cảnh báo giải thích, gợi ý hủy đơn trước nếu thực sự cần

VIỆC 3 — Chú giải và trạng thái:
Thêm chú giải màu ở đầu lịch: Có đơn / Đã chặn / Còn trống.
Chế độ xem "Danh sách" hiện có cũng cần hiển thị các ngày đã chặn.

VIỆC 4 — Nối với luồng đặt lịch:
Kiểm tra src/services/availability.ts và luồng booking: đảm bảo ngày/giờ đã chặn KHÔNG chọn được ở widget đặt lịch trên trang hồ sơ công khai. Kiểm tra ở TẦNG SERVICE, không chỉ disable ở UI — người dùng gọi API trực tiếp vẫn phải bị chặn.

VIỆC 5 — Sửa thứ tự ngày trong tuần (lỗi riêng nhưng cùng khu vực):
Widget đặt lịch trên trang hồ sơ đang hiển thị tuần bắt đầu từ Thứ 7 (Thứ 7, CN, Thứ 2, Thứ 3...), trong khi trang Lịch làm việc lại bắt đầu từ Chủ nhật. Không nhất quán và sai quy ước.
- Thống nhất TOÀN BỘ lịch trong ứng dụng bắt đầu từ Thứ 2 (quy ước phổ biến ở Việt Nam)
- Tạo một hằng số dùng chung, ví dụ WEEK_STARTS_ON = 1, đặt trong src/lib/constants
- Áp dụng cho react-day-picker và mọi chỗ dùng date-fns
- Đảm bảo tên thứ hiển thị tiếng Việt: T2, T3, T4, T5, T6, T7, CN

Viết test: ngày đã chặn không đặt được qua API; không chặn được ngày đã có đơn CONFIRMED; mọi lịch bắt đầu từ Thứ 2.
```

---

### PROMPT F4 — Tin nhắn dạng popup toàn cục

```
Đọc CLAUDE.md trước.

Hiện tin nhắn là một trang riêng (/dashboard/messages) và một icon ở header dẫn sang trang đó. Cần đổi thành popup nổi truy cập được từ MỌI trang, để người dùng không phải rời khỏi trang đang xem khi trao đổi.

Tôi để bạn chủ động thiết kế, nhưng phải đáp ứng các yêu cầu sau:

HÀNH VI:
- Bấm icon tin nhắn ở header → mở panel nổi ở góc dưới bên phải (desktop)
- Panel có 2 tầng: danh sách hội thoại → bấm vào một hội thoại thì mở khung chat, có nút quay lại
- Đóng/mở được, thu nhỏ được, giữ nguyên trạng thái khi chuyển trang
- Hiển thị số tin chưa đọc trên icon header
- Mở panel không làm mất nội dung trang đang xem, không chặn tương tác với trang

TRÊN ĐIỆN THOẠI:
Panel nổi không phù hợp màn hình nhỏ. Trên mobile, mở dạng bottom sheet chiếm toàn màn hình, có nút đóng rõ ràng. Dùng breakpoint để phân biệt.

GIỮ LẠI TRANG RIÊNG:
KHÔNG xóa /dashboard/messages. Giữ lại cho trường hợp người dùng muốn xem toàn màn hình, và để link trong email thông báo vẫn hoạt động. Thêm nút "Mở toàn màn hình" trong panel.

KỸ THUẬT:
- Dùng React Context hoặc state manager để panel truy cập được từ mọi nơi, đặt provider ở layout gốc
- Tận dụng API hiện có: /api/conversations/*, /api/conversations/[id]/messages, /api/conversations/unread-count. KHÔNG viết lại API.
- Cập nhật tin nhắn mới: dùng polling như hiện tại, đừng dựng WebSocket ở giai đoạn này
- Panel chỉ render khi người dùng đã đăng nhập
- Chú ý z-index: panel phải nổi trên mọi thứ nhưng KHÔNG đè lên dropdown thông báo và menu người dùng ở header. Rà soát toàn bộ thang z-index của ứng dụng và ghi lại thành hằng số dùng chung trong src/lib/constants, đừng rải số magic khắp nơi.

TRUY CẬP:
- Đóng được bằng phím Escape
- Bẫy focus khi panel mở
- Nhãn ARIA đầy đủ
- Điều hướng bằng bàn phím

Sau khi làm xong, chạy pnpm test:visual:update vì bố cục header thay đổi.
```

---

### PROMPT F5 — Dọn sạch phần chưa Việt hóa

```
Đọc CLAUDE.md trước.

Dù đã chọn ngôn ngữ VI, còn rất nhiều chuỗi tiếng Anh lọt ra. Đây là danh sách tôi phát hiện qua ảnh chụp màn hình — nhưng đừng chỉ sửa đúng những chỗ này, hãy rà soát toàn bộ.

ĐÃ PHÁT HIỆN:
- Trang 404: "Page not found", "The page you're looking for doesn't exist, or may have been moved.", "Go home", "Browse artists"
- Tab trang hồ sơ: "Portfolio", "Services", "Reviews"
- Nhãn trạng thái: "Available"
- Widget đặt lịch: "Book [tên]", "From 1.200.000₫ per session", "Select a service", "Select a date", "Book now"
- Trạng thái rỗng: "No portfolio items yet"
- Menu chia sẻ: "Copy link", "Share to Facebook", "Share to X", "Share via WhatsApp"
- Sidebar dashboard: "Portfolio"
- Metadata trang chủ: title và description (đã xử lý ở F2, kiểm tra lại)

VIỆC 1 — Rà soát toàn diện:
Grep toàn bộ src/ tìm chuỗi tiếng Anh hardcode chưa qua next-intl. Chú ý các chỗ hay bị bỏ sót:
- Trang lỗi: not-found.tsx, error.tsx, global-error.tsx
- Thông báo lỗi từ Zod trong src/lib/validations/*
- Thông báo lỗi trả về từ API route
- Nhãn của enum: BookingStatus, Role, ProfileCategory, NotificationType, ExperienceLevel, MediaType
- Mẫu email trong src/lib/email.ts
- Trạng thái rỗng và trạng thái loading
- Thuộc tính aria-label và alt của ảnh
- Placeholder của input
- Nội dung toast/thông báo

VIỆC 2 — Dịch:
Đưa hết vào src/messages/vi.json, dịch sang tiếng Việt tự nhiên. Nguyên tắc dịch:
- "Portfolio" giữ nguyên (người Việt trong ngành dùng từ này) NHƯNG phải nhất quán mọi nơi
- "Book now" → "Đặt lịch ngay"
- "Available" → "Đang nhận đơn"
- "From X per session" → "Từ X / buổi"
- "Services" → "Dịch vụ", "Reviews" → "Đánh giá"
- Trang 404: "Không tìm thấy trang", "Trang bạn tìm không tồn tại hoặc đã được chuyển đi", "Về trang chủ", "Tìm nghệ sĩ"
Đừng dịch máy cứng nhắc — viết như người Việt nói.

VIỆC 3 — Nhãn enum tập trung:
Tạo một chỗ duy nhất ánh xạ mọi giá trị enum sang nhãn tiếng Việt, dùng chung cho toàn ứng dụng. Hiện đang có nơi hiển thị enum thô, nơi hiển thị nhãn — cần thống nhất.

VIỆC 4 — Đặt vi làm mặc định:
Kiểm tra src/i18n/routing.ts, đảm bảo vi là defaultLocale. Người dùng mới vào lần đầu phải thấy tiếng Việt.

VIỆC 5 — Chống tái diễn:
Thêm ESLint rule cấm chuỗi ký tự trực tiếp trong JSX (ví dụ i18next/no-literal-string hoặc tương đương), để lần sau không lọt nữa. Cấu hình cho phép ngoại lệ ở những chỗ hợp lý (số, ký hiệu).

Sau khi xong, chạy pnpm test:visual:update.
```

---

### PROMPT F6 — Sửa lỗi bố cục và khoảng cách

```
Đọc CLAUDE.md trước.

Có nhiều chỗ text sát viền và các khối đè lên nhau. Dưới đây là các lỗi cụ thể tôi phát hiện, nhưng hãy rà soát toàn bộ chứ đừng chỉ sửa đúng những chỗ này.

LỖI CỤ THỂ 1 — Trang hồ sơ công khai (/profile/[username]):
- Avatar tràn qua ranh giới giữa ảnh bìa và phần nội dung, trông như lỗi chứ không như thiết kế có chủ ý
- Hàng badge (vai trò, trạng thái, điểm đánh giá) bị ép sát ngay cạnh avatar, đúng vào mép ảnh bìa
- Dòng địa chỉ nằm chồng lên vùng chuyển tiếp
- Ảnh bìa khi không có ảnh là một khối màu trơn cao bất thường
Cần thiết kế lại phần đầu trang hồ sơ: avatar và nhóm thông tin phải có khoảng cách rõ ràng với ảnh bìa, không khối nào chồng lên khối nào. Trạng thái không có ảnh bìa phải xử lý tử tế (gradient nhẹ hoặc hoa văn, chiều cao hợp lý).

LỖI CỤ THỂ 2 — Dashboard:
Dropdown thông báo đè lên thẻ thống kê "Nghệ sĩ đã lưu" và cắt ngang dòng chào "Chào buổi sáng, [tên]". Sửa z-index và vị trí đặt dropdown.

VIỆC 1 — Rà soát hệ thống khoảng cách:
Đọc docs/design-reference/design-tokens.md. Kiểm tra các token khoảng cách có được dùng nhất quán không, hay đang có padding/margin tùy tiện rải rác. Chuẩn hóa lại.

VIỆC 2 — Rà soát thang z-index:
Liệt kê mọi giá trị z-index đang dùng trong codebase. Gom thành một thang bậc rõ ràng, đặt hằng số trong src/lib/constants (ví dụ: nội dung < sticky header < dropdown < panel tin nhắn < modal < toast). Thay toàn bộ số magic bằng hằng số.

VIỆC 3 — Rà soát toàn bộ trang:
Đi qua từng trang chính (trang chủ, /browse, /profile/[username], dashboard và các trang con, /admin), tìm:
- Text chạm sát viền container
- Khối đè lên nhau
- Nút hoặc badge bị cắt
- Trạng thái rỗng trình bày kém
Báo cáo danh sách trước khi sửa, để tôi xác nhận thứ tự ưu tiên.

VIỆC 4 — Kiểm tra trên điện thoại:
Kiểm tra mọi trang ở các bề rộng 375px, 768px, 1440px. Lỗi tràn viền thường lộ ra rõ nhất ở màn hình hẹp.

VIỆC 5 — Kiểm tra nội dung dài:
Thử với dữ liệu biên: tên rất dài, mô tả rất dài, không có ảnh, không có đánh giá, giá rất lớn. Bố cục không được vỡ.

Sau khi sửa, chạy pnpm test:visual:update và xem kỹ diff ảnh snapshot.
```

---

### PROMPT F7 — Sửa chức năng chia sẻ hồ sơ

```
Đọc CLAUDE.md trước.

Khi bấm "Share to Facebook" từ trang hồ sơ, hộp thoại đăng bài của Facebook mở ra hoàn toàn trống — không có link, không có ảnh preview.

VIỆC 1 — Xác định nguyên nhân trước khi sửa:
Kiểm tra theo thứ tự này và báo cáo cho tôi:
a) Code đang sinh URL chia sẻ như thế nào? Facebook cần dạng
   https://www.facebook.com/sharer/sharer.php?u=<URL đã encode>
   Kiểm tra tham số u có tồn tại và đã encodeURIComponent chưa.
b) URL đang chia sẻ là gì? Nếu đang lấy window.location.href khi chạy ở localhost thì Facebook KHÔNG THỂ đọc được — đây có thể là toàn bộ nguyên nhân. Phải luôn dùng URL production tuyệt đối, dựng từ NEXT_PUBLIC_APP_URL, không dùng window.location.
c) Trang /profile/[username] có thẻ Open Graph đầy đủ chưa: og:title, og:description, og:image, og:url, og:type?

VIỆC 2 — Sửa URL chia sẻ:
- Luôn dùng URL tuyệt đối dựng từ NEXT_PUBLIC_APP_URL + đường dẫn hồ sơ
- Facebook: sharer.php?u=<encoded>
- Nút "Copy link" cũng phải copy URL tuyệt đối production, không phải localhost

VIỆC 3 — Thẻ Open Graph cho trang hồ sơ:
Trong generateMetadata của /profile/[username]:
- og:title = tên hiển thị + vai trò, ví dụ "Mai Hương — Chuyên viên trang điểm | Fgrapher"
- og:description = phần mô tả của provider, cắt còn 160 ký tự
- og:image = ảnh bìa hoặc ảnh portfolio đầu tiên đã APPROVED; nếu không có thì sinh ảnh động bằng next/og với tên, vai trò, khu vực trên nền thương hiệu
- og:url = URL tuyệt đối
- og:type = profile
- Thẻ Twitter card tương ứng
- Kích thước ảnh OG: 1200x630

VIỆC 4 — Đổi danh sách kênh chia sẻ cho phù hợp thị trường Việt Nam:
Hiện có: Copy link, Facebook, X, WhatsApp.
Ở Việt Nam X và WhatsApp gần như không ai dùng. Đổi thành:
- Sao chép liên kết
- Chia sẻ qua Facebook
- Chia sẻ qua Zalo (dùng sharer của Zalo)
- Chia sẻ qua Messenger
- Tạo mã QR (hữu ích để provider in ra hoặc để trong bio)
Bỏ X và WhatsApp.

VIỆC 5 — Kiểm chứng:
QUAN TRỌNG: không thể kiểm chứng Open Graph trên localhost. Sau khi deploy lên Vercel, tự kiểm tra bằng công cụ debug của Facebook và của X, rồi báo cáo kết quả. Nếu Facebook đã cache phiên bản cũ, dùng chức năng Scrape Again.

VIỆC 6 — Nhất quán:
Áp dụng cùng cách xử lý Open Graph cho các trang landing theo tỉnh (/photographer/ha-noi...) và trang chủ.
```

---

## PHẦN C — VIỆC BẠN CẦN LÀM

| # | Việc | Vì sao |
|---|---|---|
| 1 | **Kiểm tra lại chức năng share trên fgrapher.vercel.app, không phải localhost** | Facebook không đọc được localhost. Có thể L10 không phải lỗi thật. |
| 2 | Chuẩn bị file logo dạng SVG nền trong suốt để làm favicon | Claude Code không tự tạo logo được |
| 3 | Xác nhận có muốn giữ trang /pricing không | F2 bỏ nó khỏi navigation nhưng vẫn giữ trang |
| 4 | Sau khi F1 xong, tự duyệt 8 ảnh đang kẹt và kiểm tra hồ sơ có lên công khai không | Đây là phép thử toàn bộ chuỗi |
| 5 | Cân nhắc quy trình duyệt ảnh khi có nhiều provider | Duyệt tay từng ảnh sẽ không kham nổi ở quy mô lớn — cần tính trước |

---

## PHẦN D — MỘT LƯU Ý VỀ QUY TRÌNH

Lỗi L07 (không có màn hình duyệt ảnh) và L11 (admin không có lối vào) đáng chú ý không phải vì khó sửa, mà vì **cả hai đều là chuỗi tính năng bị đứt giữa chừng**: phần provider làm xong, phần admin thì không. Kiểm thử tự động không bắt được loại lỗi này vì mỗi phần riêng lẻ đều chạy đúng.

Cách phòng: mỗi khi thêm một trạng thái cần con người xử lý (`PENDING`, `chờ duyệt`, `chờ xác minh`), hãy hỏi ngay — *ai bấm nút chuyển trạng thái này, và họ vào màn hình nào để bấm?* Nếu chưa trả lời được thì tính năng chưa xong.

---

*Đánh giá dựa trên file Excel, 11 ảnh chụp màn hình nhúng trong đó, nội dung trang chủ fgrapher.vercel.app, và cấu trúc dự án từ fgrapher-context.md. Một số nhận định về nguyên nhân gốc là suy luận từ ảnh, cần Claude Code xác nhận khi đọc code thật.*
