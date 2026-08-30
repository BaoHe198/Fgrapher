# Fgrapher — Bộ prompt đợt 2: bổ sung tính năng & sửa lỗi

**Ngày:** 29/08/2026
**Nguồn:** file Excel đợt 2 (7 mục + 4 ảnh nhúng), đối chiếu với schema và cấu trúc dự án đã phân tích.

**Ghi nhận tiến độ:** ảnh chụp cho thấy đợt trước đã chạy — thanh điều hướng còn đúng một mục "Tìm kiếm", trang 404 đã Việt hóa ("Không tìm thấy trang", "Về trang chủ", "Tìm nghệ sĩ"), hộp thoại tải ảnh đã có checkbox xác nhận quyền sử dụng ảnh. Tốt.

---

## PHẦN A — PHÂN LOẠI 7 MỤC

Bảy mục này không cùng loại. Cần tách ra vì cách xử lý khác nhau:

| # | Mục | Bản chất | Ước lượng |
|---|---|---|---|
| N01 | Album: tải lên theo album, có mô tả, gắn thể loại | **Bổ sung schema + tính năng** | 3–4 ngày |
| N02 | Trang cài đặt bị lỗi 404 | **Lỗi** | 2 giờ |
| N03 | Không có chỗ thêm avatar và ảnh bìa; thiếu cài đặt thể loại sở trường | **Lỗ hổng chức năng** | 2 ngày |
| N04 | Bộ lọc tìm kiếm thiếu thể loại sở trường theo vai trò | **Bổ sung tính năng** | 1–2 ngày |
| N05 | Card nghệ sĩ: thiếu avatar, chỉ hiện 1 ảnh | **Cải thiện giao diện** | 1 ngày |
| N06 | Tăng cỡ chữ, đậm hơn | **Cải thiện giao diện** | nửa ngày |
| N07 | Tạo yêu cầu + Danh sách yêu cầu (mô hình ngược) | **Epic mới** | 2–3 tuần |

### A1. N02 — lỗi lặp lại cùng một dạng

Ảnh cho thấy trang 404 sau khi bấm vào Cài đặt. Đây là **cùng loại lỗi với `/dashboard/profile`** ở đợt trước: đường dẫn trong menu không khớp với đường dẫn thật của trang.

Dự án có các trang cài đặt tại `/dashboard/settings/account`, `/settings/profile`, `/settings/notifications`, `/settings/billing`, `/settings/roles` — nhưng **không có trang `/dashboard/settings` gốc**. Bấm vào "Cài đặt" ở sidebar mà không có trang chỉ mục thì rơi vào 404.

Đợt trước tôi có yêu cầu Claude Code rà soát toàn bộ đường dẫn dashboard bị lệch. Việc đó rõ ràng chưa làm tới nơi. Lần này cần làm dứt điểm bằng test tự động, không chỉ sửa tay.

### A2. N01 — cần thêm model mới, không chỉ thêm UI

Ảnh hộp thoại tải ảnh cho thấy hiện tại: kéo thả file → mỗi file một ô "Tiêu đề (không bắt buộc)" → tải lên. Không có khái niệm album, không có mô tả, không có thể loại.

Nguyên nhân nằm ở schema: **`ProfileMedia` gắn thẳng vào `Profile`, không có model `Album`**. Cấu trúc hiện tại là một danh sách ảnh phẳng. Muốn có album thì phải thêm một tầng.

Điểm cần cẩn thận khi migrate: đã có ảnh thật trong hệ thống (8 ảnh của Mai Hương). Migration phải gom chúng vào một album mặc định, không được để mồ côi.

### A3. N03 + N04 — dữ liệu đã có, chỉ thiếu giao diện

Đây là tin tốt. Schema **đã có sẵn** `ProfileCategory` với đầy đủ các nhóm phân theo vai trò:

- Nhiếp ảnh/quay phim: WEDDING, PORTRAIT, FASHION, COMMERCIAL, EVENT, PRODUCT, FOOD, LANDSCAPE, STREET, DOCUMENTARY, MUSIC_VIDEO, CORPORATE, REAL_ESTATE
- Trang điểm: BRIDAL, EDITORIAL, SFX, NATURAL, GLAM
- Studio: INDOOR, OUTDOOR, ROOFTOP, CYCLORAMA, GREEN_SCREEN
- Người mẫu: FASHION_MODEL, COMMERCIAL_MODEL, FITNESS_MODEL, PORTRAIT_MODEL, HAND_FOOT_MODEL, PLUS_SIZE, PETITE, MATURE, ALTERNATIVE

`Profile` cũng đã có quan hệ `categories ProfileCategory[]`.

Nghĩa là **cả N03 (chọn sở trường) và N04 (lọc theo sở trường) chỉ thiếu phần giao diện**, không cần đụng schema. Việc nhẹ hơn nhiều so với vẻ bề ngoài.

Điểm mấu chốt: danh sách thể loại phải **lọc theo vai trò**. Người mẫu không được thấy lựa chọn "Ảnh cưới", studio không được thấy "SFX". Cần một bảng ánh xạ vai trò → nhóm thể loại, đặt ở một chỗ duy nhất, dùng chung cho cả trang cài đặt hồ sơ lẫn bộ lọc tìm kiếm.

Về avatar và ảnh bìa: `User` đã có trường `avatar` và `coverImage`. Lại là chuyện thiếu giao diện chứ không thiếu dữ liệu. Nhưng cần làm rõ một điểm mơ hồ trong thiết kế: **`avatar` nằm ở `User` còn portfolio nằm ở `Profile`, mà một người có thể có nhiều `Profile` theo nhiều vai trò.** Vậy khi một người vừa là photographer vừa là model, hai hồ sơ dùng chung một avatar hay mỗi hồ sơ một avatar? Cần chốt trước khi làm.

### A4. N05 — card đang vỡ ở trạng thái rỗng

Ảnh cho thấy ba card nghệ sĩ, trong đó **hai card có vùng ảnh xám trống trơn**. Đó là những provider chưa có ảnh portfolio nào được duyệt. Card không xử lý trạng thái rỗng, để lại một khối xám vô nghĩa.

Yêu cầu của bạn (thêm avatar, cho lướt nhiều ảnh) đúng, nhưng cần bổ sung: **xử lý cả trường hợp không có ảnh nào**. Nếu không, sau khi thêm carousel thì card của provider mới vẫn xấu như cũ.

Vài điểm khác nhìn thấy trong ảnh:
- Tên dài bị xuống 3 dòng ("Mai Hương Makeup") khiến chiều cao các card lệch nhau
- Nhãn vai trò của Thanh Tùng xuống 2 hàng ("Nhiếp ảnh gia" + "Quay phim") đẩy bố cục lệch tiếp
- Hiển thị "Mới (0)" cạnh biểu tượng sao — cách thể hiện provider chưa có đánh giá còn lúng túng

### A5. N07 — không phải lỗi, là epic mới

Bạn muốn mô hình của potonow: <cite index="12-1">khách hàng đặt lịch với yêu cầu và chi phí mong muốn, các nhiếp ảnh gia phù hợp sẽ chủ động gửi đề nghị chụp đến khách</cite>. Đây chính là mục S10 trong tài liệu phân tích ban đầu — mô hình ngược, khách đăng nhu cầu thay vì đi tìm từng người.

**Tại sao đây là bổ sung có giá trị:** nó tấn công đúng bài toán cold start từ phía cầu. Khách không cần duyệt qua danh sách provider thưa thớt; họ chỉ cần mô tả nhu cầu, còn việc tìm nhau là của provider. Và ý tưởng mở rộng cho nhiều vai trò (không chỉ photographer như potonow) là **điểm khác biệt thật sự** — khách tổ chức một buổi chụp có thể cần cả thợ chụp, make-up, người mẫu và studio trong cùng một yêu cầu.

**Nhưng có ba rủi ro cần xử lý ngay từ thiết kế:**

1. **Rò rỉ dữ liệu cá nhân.** Yêu cầu chụp thường chứa ngày giờ, địa điểm cụ thể, đôi khi là địa chỉ nhà. Nếu hiển thị công khai, đây vừa là vi phạm dữ liệu cá nhân, vừa là rủi ro an toàn thật — đăng công khai "chụp tại nhà, địa chỉ X, 14h ngày Y" là chuyện nguy hiểm. **Chỉ provider đã xác minh mới được xem, và địa chỉ chi tiết phải ẩn cho tới khi khách chọn.**

2. **Yêu cầu ảo.** Potonow chặn bằng cách bắt đặt cọc trước khi mở group chat. Fgrapher không có thanh toán, nên phải chặn bằng cách khác: xác thực số điện thoại, giới hạn số yêu cầu mở cùng lúc, tự đóng yêu cầu quá hạn.

3. **Yêu cầu không ai nhận.** Khi nguồn cung còn mỏng, một yêu cầu treo không có đề nghị nào sẽ tệ hơn cả việc tìm kiếm thủ công. Cần có phương án: thông báo chủ động cho provider phù hợp, và nếu quá 48h không ai chào thì gợi ý khách chuyển sang đặt lịch trực tiếp.

**Khuyến nghị về thứ tự:** làm N07 **sau cùng**, sau khi N01–N06 xong. Lý do: mô hình ngược chỉ phát huy tác dụng khi hồ sơ provider đã đầy đủ (có album, có thể loại sở trường, có avatar). Làm ngược lại thì provider nhận được yêu cầu nhưng hồ sơ của họ chưa đủ sức thuyết phục khách chọn.

### A6. Thứ tự xử lý đề xuất

| Đợt | Nội dung | Ước lượng |
|---|---|---|
| 1 | N02 — sửa 404 cài đặt + rà soát dứt điểm mọi route | 2 giờ |
| 2 | N03 — avatar, ảnh bìa, thể loại sở trường | 2 ngày |
| 3 | N01 — album | 3–4 ngày |
| 4 | N04 — bộ lọc thể loại | 1–2 ngày |
| 5 | N05 — card nghệ sĩ | 1 ngày |
| 6 | N06 — chữ | nửa ngày |
| 7 | N07 — mô hình yêu cầu | 2–3 tuần |

---

## PHẦN B — BỘ PROMPT

---

### PROMPT G1 — Sửa 404 trang cài đặt và rà soát dứt điểm

```
Đọc CLAUDE.md trước.

Bấm "Cài đặt" ở sidebar dashboard dẫn tới trang 404. Đây là lần thứ hai gặp lỗi cùng dạng (lần trước là /dashboard/profile) — nghĩa là lần rà soát trước chưa làm tới nơi. Lần này cần giải quyết dứt điểm bằng test tự động, không chỉ sửa tay.

VIỆC 1 — Sửa lỗi trước mắt:
Dự án có /dashboard/settings/account, /settings/profile, /settings/notifications, /settings/billing, /settings/roles nhưng KHÔNG có trang chỉ mục /dashboard/settings.
Tạo trang /dashboard/settings làm trang chỉ mục: liệt kê các nhóm cài đặt kèm mô tả ngắn mỗi mục, dạng danh sách bấm được. Hoặc redirect sang /dashboard/settings/profile — bạn chọn phương án nào hợp lý hơn rồi giải thích cho tôi.

VIỆC 2 — Rà soát TOÀN BỘ đường dẫn nội bộ:
- Liệt kê mọi route thực sự tồn tại trong src/app (quét hệ thống file, không dựa vào trí nhớ)
- Grep mọi đường dẫn nội bộ xuất hiện trong: component Link, router.push, redirect, sidebar, header, footer, mẫu email, thông báo, sitemap, breadcrumb
- Đối chiếu hai danh sách, liệt kê MỌI đường dẫn trỏ tới route không tồn tại
- Sửa từng cái. Với đường dẫn có thể đã bị chia sẻ ra ngoài, thêm redirect thay vì xóa.
- Báo cáo cho tôi danh sách đầy đủ những gì đã tìm thấy

VIỆC 3 — Chặn tái diễn bằng test:
Viết một test Playwright quét toàn bộ liên kết:
- Đăng nhập lần lượt bằng từng vai trò: CUSTOMER, PHOTOGRAPHER, MODEL, ADMIN
- Với mỗi vai trò, duyệt qua mọi mục trong sidebar, header, footer
- Bấm vào từng liên kết, xác nhận KHÔNG trang nào trả 404
- Test này phải chạy trong CI, để lần sau lỗi này không lọt được nữa

VIỆC 4 — Kiểm tra riêng phần chỉ hiện với một vai trò:
Một số mục menu chỉ hiện với vai trò nhất định (khu quản trị, quản lý gói). Đảm bảo test bao phủ cả những mục này, đừng bỏ sót vì tài khoản test không thấy chúng.
```

---

### PROMPT G2 — Ảnh đại diện, ảnh bìa và thể loại sở trường

```
Đọc CLAUDE.md trước.

Provider hiện không tìm thấy chỗ nào để thêm ảnh đại diện và ảnh bìa, cũng không có chỗ khai thể loại sở trường.

LƯU Ý: dữ liệu đã có sẵn, chỉ thiếu giao diện.
- User đã có trường avatar và coverImage
- Schema đã có enum ProfileCategory đầy đủ, phân theo vai trò
- Profile đã có quan hệ categories ProfileCategory[]
ĐỌC code hiện có trước, đừng thêm trường mới nếu đã có.

VIỆC 1 — Làm rõ một điểm thiết kế trước khi code:
avatar và coverImage nằm ở model User, nhưng portfolio nằm ở Profile — mà một người có thể có nhiều Profile theo nhiều vai trò (vừa photographer vừa model chẳng hạn).
Hãy phân tích code hiện tại và đề xuất cho tôi: dùng chung một avatar cho mọi vai trò, hay mỗi hồ sơ vai trò một avatar riêng? Nêu ưu nhược điểm rồi CHỜ TÔI CHỌN trước khi làm tiếp.
Gợi ý cân nhắc: avatar là khuôn mặt con người nên dùng chung hợp lý; ảnh bìa mang tính nghề nghiệp nên có thể khác nhau giữa hồ sơ photographer và hồ sơ model.

VIỆC 2 — Giao diện tải avatar và ảnh bìa:
Thêm vào /dashboard/settings/profile:
- Khu vực ảnh bìa ở trên cùng, tỉ lệ 3:1, có nút tải lên/thay/xóa, xem trước ngay
- Ảnh đại diện dạng tròn chồng lên ảnh bìa, có nút tải lên/thay/xóa
- Cho cắt ảnh trước khi lưu (tỉ lệ cố định: avatar 1:1, bìa 3:1) để tránh ảnh méo hoặc lệch khung
- Giới hạn 5MB, chấp nhận jpg/png/webp
- Xóa EXIF khi tải lên, giống quy trình ảnh portfolio
- Avatar và ảnh bìa KHÔNG cần qua kiểm duyệt như ảnh portfolio, nhưng vẫn phải qua bộ quét nội dung nhạy cảm — nếu bị đánh dấu thì chặn ngay và thông báo

VIỆC 3 — Bảng ánh xạ vai trò và thể loại:
Tạo MỘT chỗ duy nhất trong src/lib/constants ánh xạ Role sang danh sách ProfileCategory hợp lệ:
- PHOTOGRAPHER, VIDEOGRAPHER → WEDDING, PORTRAIT, FASHION, COMMERCIAL, EVENT, PRODUCT, FOOD, LANDSCAPE, STREET, DOCUMENTARY, MUSIC_VIDEO, CORPORATE, REAL_ESTATE
- MAKEUP_ARTIST → BRIDAL, EDITORIAL, SFX, NATURAL, GLAM
- STUDIO → INDOOR, OUTDOOR, ROOFTOP, CYCLORAMA, GREEN_SCREEN
- MODEL → FASHION_MODEL, COMMERCIAL_MODEL, FITNESS_MODEL, PORTRAIT_MODEL, HAND_FOOT_MODEL, PLUS_SIZE, PETITE, MATURE, ALTERNATIVE
Kèm nhãn tiếng Việt cho từng giá trị, qua next-intl. Bảng này dùng chung cho cả trang cài đặt hồ sơ lẫn bộ lọc tìm kiếm — KHÔNG được định nghĩa hai lần.

VIỆC 4 — Giao diện chọn sở trường:
Trong /dashboard/settings/profile, thêm mục "Thể loại sở trường":
- CHỈ hiện những thể loại hợp lệ với vai trò của hồ sơ đang sửa
- Chọn nhiều, dạng chip bấm được, tối đa 5 thể loại (buộc provider phải chọn cái mình mạnh nhất, thay vì tích hết)
- Ít nhất 1 thể loại là bắt buộc trước khi công khai hồ sơ
- Nếu tài khoản có nhiều vai trò, mỗi hồ sơ vai trò khai sở trường riêng

VIỆC 5 — Hiển thị trên hồ sơ công khai:
Thể loại sở trường hiện dạng chip ở phần đầu trang hồ sơ, dưới tên và vai trò. Bấm vào một chip dẫn tới trang tìm kiếm đã lọc sẵn theo thể loại đó.

VIỆC 6 — Cập nhật thanh tiến độ hoàn thiện hồ sơ:
Thanh "Hoàn thiện hồ sơ" trên dashboard cần tính cả: đã có avatar chưa, đã có ảnh bìa chưa, đã chọn thể loại sở trường chưa. Nêu rõ còn thiếu gì thay vì chỉ hiện phần trăm.
```

---

### PROMPT G3 — Album portfolio

```
Đọc CLAUDE.md trước.

Portfolio hiện là một danh sách ảnh phẳng: ProfileMedia gắn thẳng vào Profile, không có khái niệm album. Cần thêm một tầng album có tiêu đề, mô tả và thể loại.

VIỆC 1 — Schema:
Thêm model Album:
  id, profileId, title, description (Text?), category (ProfileCategory),
  coverMediaId (String?), sortOrder Int, isPublished Boolean @default(true),
  shootDate DateTime? (ngày thực hiện buổi chụp, tùy chọn),
  createdAt, updatedAt
  @@index([profileId, sortOrder])
Thêm vào ProfileMedia: albumId String? và quan hệ tương ứng, giữ nullable để tương thích ngược.

MIGRATION PHẢI CẨN THẬN: đã có ảnh thật trong hệ thống. Migration phải:
- Tạo một album mặc định tên "Ảnh chưa phân loại" cho mỗi Profile đang có ảnh
- Gán toàn bộ ảnh hiện có vào album đó
- KHÔNG để ảnh nào mồ côi
- Migration phải reversible
Viết script kiểm tra sau migration: đếm số ảnh trước và sau, xác nhận bằng nhau.

VIỆC 2 — Giao diện quản lý album tại /dashboard/portfolio:
- Xem dạng lưới các album, mỗi album hiện ảnh bìa, tiêu đề, thể loại, số lượng ảnh
- Nút "Tạo album mới"
- Form album: tiêu đề (bắt buộc), mô tả (tùy chọn), thể loại (bắt buộc, lọc theo vai trò dùng bảng ánh xạ đã tạo ở G2), ngày chụp (tùy chọn)
- Kéo thả sắp xếp thứ tự album (đã có @dnd-kit trong dự án, dùng lại)
- Bấm vào album để mở, xem và sắp xếp ảnh bên trong
- Chọn ảnh bìa cho album
- Xóa album: hỏi rõ sẽ xử lý ảnh bên trong thế nào (xóa luôn, hay chuyển về "Ảnh chưa phân loại")

VIỆC 3 — Sửa hộp thoại tải ảnh:
Hộp thoại hiện tại chỉ có kéo thả file và ô "Tiêu đề" cho từng ảnh. Cần sửa thành:
- Bước 1: chọn album đích — chọn album có sẵn HOẶC tạo album mới ngay tại chỗ (nhập tiêu đề, mô tả, thể loại)
- Bước 2: kéo thả file
- Bước 3: tiêu đề riêng cho từng ảnh (giữ nguyên, vẫn không bắt buộc)
- Giữ nguyên checkbox xác nhận quyền sử dụng ảnh — đây là yêu cầu pháp lý, không được bỏ
- Giữ nguyên giới hạn dung lượng đang hiển thị
- Số ảnh tối đa vẫn tính theo gói thuê bao, tính trên TỔNG số ảnh của hồ sơ chứ không phải theo từng album

VIỆC 4 — Hiển thị trên hồ sơ công khai:
Tab Portfolio đổi từ lưới ảnh phẳng thành lưới album. Bấm vào album mở chế độ xem ảnh lớn, lướt được. Hiện tiêu đề, mô tả, thể loại của album.
Album không có ảnh nào đã duyệt thì KHÔNG hiện với khách.

VIỆC 5 — Kiểm duyệt vẫn giữ ở cấp ảnh:
Album không cần duyệt, nhưng từng ảnh trong album vẫn phải qua kiểm duyệt như hiện tại. Màn hình duyệt của admin cần hiện thêm ảnh này thuộc album nào để người duyệt có ngữ cảnh.

Viết test: migration không làm mất ảnh; album rỗng không hiện công khai; giới hạn số ảnh theo gói vẫn đúng khi tính trên nhiều album.
```

---

### PROMPT G4 — Bộ lọc thể loại trong tìm kiếm

```
Đọc CLAUDE.md trước.

Bộ lọc tìm kiếm hiện có: Vai trò, Sắp xếp theo, Tỉnh/thành, Ngân sách, Đánh giá. Thiếu bộ lọc theo thể loại sở trường — đây là tiêu chí quan trọng nhất khi khách chọn thợ chụp, quan trọng hơn cả giá.

VIỆC 1 — Bộ lọc thể loại động theo vai trò:
Thêm mục "Thể loại" vào bộ lọc, dùng lại bảng ánh xạ vai trò-thể loại đã tạo ở G2 (KHÔNG định nghĩa lại).

Hành vi:
- Khi CHƯA chọn vai trò nào: hiện các thể loại phổ biến nhất trên toàn nền tảng, có nút "Xem tất cả"
- Khi ĐÃ chọn một vai trò: chỉ hiện thể loại hợp lệ với vai trò đó
- Khi chọn NHIỀU vai trò: hiện hợp của các nhóm thể loại, có tiêu đề nhóm phân cách theo vai trò
- Khi đổi vai trò làm một thể loại đã chọn trở nên không hợp lệ: tự bỏ chọn thể loại đó VÀ báo cho người dùng biết bằng một dòng thông báo nhẹ, đừng im lặng bỏ

VIỆC 2 — Hiển thị:
- Chọn nhiều được, dạng checkbox hoặc chip
- Hiện số lượng provider theo từng thể loại, giống cách bộ lọc Vai trò đang làm ("Nhiếp ảnh gia (2)")
- Thể loại có 0 provider thì làm mờ hoặc ẩn, đừng để người dùng chọn rồi nhận kết quả rỗng
- Nhóm dài thì thu gọn, có nút "Xem thêm"

VIỆC 3 — Backend:
Sửa src/services/search.ts thêm điều kiện lọc theo categories. Đồng bộ vào URL query để chia sẻ link được. Thêm index database phù hợp.

VIỆC 4 — Nối với trang landing SEO:
Nếu đã có các trang landing theo tỉnh, cân nhắc mở rộng thành tổ hợp vai trò × thể loại × tỉnh cho các thể loại phổ biến nhất — ví dụ /nhiep-anh-gia/chup-cuoi/ha-noi. ĐỪNG sinh toàn bộ tổ hợp (sẽ ra hàng nghìn trang mỏng, hại SEO). Chỉ sinh cho các tổ hợp thực sự có provider, tối thiểu 3 provider mới sinh trang.
Phân tích và đề xuất phương án trước khi làm.

VIỆC 5 — Trạng thái rỗng:
Khi bộ lọc quá hẹp và không có kết quả, gợi ý cụ thể nên bỏ tiêu chí nào, thay vì chỉ báo "không tìm thấy".
```

---

### PROMPT G5 — Cải thiện card nghệ sĩ

```
Đọc CLAUDE.md trước.

Card nghệ sĩ trong trang tìm kiếm hiện chỉ hiện một ảnh portfolio đầu tiên, không có avatar. Provider chưa có ảnh nào được duyệt thì card chỉ là một khối xám trống trơn — trông như lỗi.

VIỆC 1 — Xử lý trạng thái không có ảnh (làm việc này TRƯỚC):
Đây là vấn đề cấp bách hơn cả carousel, vì provider mới nào cũng rơi vào trạng thái này.
Khi không có ảnh portfolio đã duyệt:
- Không để khối xám trống. Dùng nền gradient theo màu thương hiệu, hoặc hoa văn nhẹ
- Hiện avatar cỡ lớn ở giữa vùng đó
- Nếu cũng không có avatar: hiện chữ cái đầu tên trên nền màu sinh theo tên (mỗi người một màu ổn định)
- Có thể thêm nhãn nhẹ "Chưa có ảnh portfolio" — nhưng cân nhắc kỹ, đừng làm provider mới trông kém uy tín

VIỆC 2 — Thêm avatar vào card:
Hiện avatar tròn nhỏ chồng lên góc dưới bên trái vùng ảnh, hoặc cạnh tên — bạn chọn phương án hợp lý hơn về mặt thị giác rồi giải thích. Phải có viền phân tách rõ với ảnh nền.

VIỆC 3 — Lướt nhiều ảnh:
- Cho lướt qua tối đa 5 ảnh portfolio đã duyệt trong card
- Desktop: hiện mũi tên trái/phải khi rê chuột vào card
- Mobile: vuốt ngang
- Chấm chỉ số vị trí ở dưới
- Ảnh tải lười (lazy) — chỉ tải ảnh đầu tiên khi render, các ảnh sau tải khi người dùng tương tác. Trang tìm kiếm có nhiều card, tải hết ngay sẽ rất nặng.
- Bấm vào ảnh vẫn dẫn sang trang hồ sơ, không mở lightbox — đừng giữ người dùng lại ở trang tìm kiếm

VIỆC 4 — Sửa bố cục lệch:
Ảnh chụp cho thấy các card cao thấp không đều vì:
- Tên dài xuống 3 dòng ("Mai Hương Makeup")
- Provider nhiều vai trò có nhãn xuống 2 hàng ("Nhiếp ảnh gia" + "Quay phim")
Cần: chiều cao card cố định, tên cắt bớt sau 2 dòng có dấu ba chấm, nhãn vai trò hiện tối đa 2 cái rồi "+1", các phần tử canh thẳng hàng giữa các card.

VIỆC 5 — Cách hiển thị provider chưa có đánh giá:
Hiện đang là "Mới (0)" cạnh biểu tượng sao, trông lúng túng. Đổi thành nhãn "Mới" rõ ràng hơn, hoặc hiện số buổi chụp đã hoàn thành thay cho điểm đánh giá. Đề xuất phương án cho tôi.

Sau khi làm xong chạy pnpm test:visual:update.
```

---

### PROMPT G6 — Cỡ chữ và độ đậm

```
Đọc CLAUDE.md và docs/design-reference/design-tokens.md trước.

Chữ hiện quá nhỏ và quá nhạt, khó đọc. Cần tăng cỡ và độ đậm trên toàn ứng dụng.

VIỆC 1 — Rà soát trước khi sửa:
Đọc bộ design token hiện có. Báo cáo cho tôi: thang cỡ chữ đang dùng, các mức độ đậm, độ tương phản màu chữ trên nền. Chỉ ra chỗ nào dưới ngưỡng dễ đọc.

VIỆC 2 — Chuẩn mực cần đạt:
- Chữ nội dung tối thiểu 16px (nhiều nơi hiện đang 14px hoặc nhỏ hơn)
- Chữ phụ, chú thích tối thiểu 14px, không nhỏ hơn
- Chiều cao dòng tối thiểu 1.5 cho đoạn văn
- Độ tương phản đạt WCAG AA: tối thiểu 4.5:1 cho chữ thường, 3:1 cho chữ lớn
- Chữ phụ đang dùng màu xám quá nhạt trên nền tối — kiểm tra và tăng độ tương phản
- Nhãn form và giá trị: tăng độ đậm để phân biệt rõ

LƯU Ý VỀ TIẾNG VIỆT: tiếng Việt có nhiều dấu thanh và dấu phụ chồng lên nhau. Chiều cao dòng quá chật sẽ khiến dấu bị cắt hoặc dính vào dòng trên. Kiểm tra kỹ với các chữ nhiều dấu như "ế", "ự", "ỡ", "ặ".

VIỆC 3 — Sửa ở tầng token, không sửa lẻ:
Cập nhật trong design token và cấu hình Tailwind, KHÔNG sửa từng component một. Nếu component nào ghi đè cỡ chữ trực tiếp thì gỡ chỗ ghi đè đó.

VIỆC 4 — Rà soát các chỗ hay bị bỏ sót:
Nhãn form, chú thích dưới ô nhập, thông báo lỗi, trạng thái rỗng, chữ trong badge, ghi chú trong bảng, tooltip, tiêu đề cột.

VIỆC 5 — Kiểm tra lại toàn bộ:
Sau khi tăng cỡ chữ, bố cục sẽ thay đổi. Kiểm tra mọi trang ở 375px, 768px, 1440px xem có chỗ nào tràn, cắt chữ, hay vỡ hàng không. Chú ý các nút có chữ dài tiếng Việt.

Chạy pnpm test:visual:update và xem kỹ diff ảnh snapshot.
```

---

### PROMPT G7 — Tạo yêu cầu và Danh sách yêu cầu

```
Đọc CLAUDE.md trước.

Đây là TÍNH NĂNG MỚI LỚN, không phải sửa lỗi. Trước khi code, hãy đọc kỹ toàn bộ prompt này rồi trình bày cho tôi thiết kế của bạn để tôi duyệt.

BỐI CẢNH:
Hiện Fgrapher chỉ có một chiều: khách đi tìm provider rồi đặt lịch. Cần thêm chiều ngược lại: khách đăng nhu cầu kèm ngân sách, provider phù hợp chủ động gửi đề nghị, khách chọn.

Mô hình này giống Potonow nhưng có một khác biệt quan trọng: Potonow chỉ áp dụng cho nhiếp ảnh gia, còn Fgrapher phải hỗ trợ NHIỀU VAI TRÒ — một yêu cầu có thể cần cùng lúc thợ chụp, make-up, người mẫu và studio.

=== BA RÀNG BUỘC BẮT BUỘC ===

1. BẢO VỆ DỮ LIỆU CÁ NHÂN
Yêu cầu chụp chứa ngày giờ, địa điểm, đôi khi là địa chỉ nhà của khách. Đăng công khai là vi phạm dữ liệu cá nhân và là rủi ro an toàn thật.
- Yêu cầu CHỈ hiển thị với provider đã xác minh danh tính (verificationStatus = VERIFIED)
- KHÔNG hiển thị công khai cho khách vãng lai, KHÔNG cho công cụ tìm kiếm lập chỉ mục (noindex)
- Ở danh sách chỉ hiện tỉnh/thành và khu vực chung, KHÔNG hiện địa chỉ chi tiết
- Địa chỉ chi tiết và số điện thoại chỉ lộ ra SAU KHI khách chấp nhận một đề nghị
- Ghi AuditLog mỗi lần một provider xem chi tiết yêu cầu

2. CHỐNG YÊU CẦU ẢO
Potonow chặn bằng cách bắt đặt cọc. Fgrapher không có thanh toán nên phải chặn cách khác:
- Chỉ tài khoản đã xác thực số điện thoại mới đăng được yêu cầu
- Tối đa 3 yêu cầu đang mở cùng lúc cho mỗi khách
- Yêu cầu tự đóng sau 7 ngày nếu khách không chọn ai
- Khách hủy quá nhiều lần sau khi đã nhận đề nghị thì bị hạn chế

3. XỬ LÝ YÊU CẦU KHÔNG AI NHẬN
Khi nguồn cung mỏng, yêu cầu treo không đề nghị nào còn tệ hơn việc tự đi tìm.
- Khi có yêu cầu mới, thông báo chủ động cho các provider phù hợp (đúng vai trò, đúng tỉnh hoặc nhận toàn quốc, đúng thể loại sở trường, còn trống lịch ngày đó)
- Sau 48h không có đề nghị nào: thông báo cho khách, gợi ý nới ngân sách hoặc chuyển sang đặt lịch trực tiếp, kèm danh sách provider phù hợp
- Trang quản trị hiện các yêu cầu chưa ai nhận để đội vận hành can thiệp thủ công

=== SCHEMA ===

model ServiceRequest {
  id, code (mã dễ đọc, ví dụ YC-2026-00042), customerId,
  title, description (Text),
  shootDate DateTime?, isDateFlexible Boolean, dateRangeStart?, dateRangeEnd?,
  provinceCode, areaNote (khu vực chung, hiện công khai với provider),
  detailedAddress (String?, CHỈ lộ sau khi chấp nhận đề nghị),
  budgetMin, budgetMax, currency @default("VND"),
  status (OPEN | HAS_OFFERS | FULFILLED | EXPIRED | CANCELLED),
  expiresAt, createdAt, updatedAt
}

model ServiceRequestRole {
  // Một yêu cầu có thể cần nhiều vai trò cùng lúc
  id, requestId, role (Role), categories (ProfileCategory[]),
  quantity Int @default(1), budgetMin?, budgetMax?,
  fulfilledByOfferId String?
}

model ServiceRequestReference {
  // Ảnh tham khảo về concept mong muốn
  id, requestId, mediaUrl, publicId
}

model RequestOffer {
  id, requestId, requestRoleId, providerId,
  message (Text), proposedPrice, proposedDate?,
  status (PENDING | ACCEPTED | DECLINED | WITHDRAWN),
  createdAt
  @@unique([requestRoleId, providerId])  // mỗi provider chỉ chào một lần cho mỗi vai trò
}

=== LUỒNG NGHIỆP VỤ ===

Khách tạo yêu cầu (form nhiều bước):
  Bước 1: Cần những ai? (chọn nhiều vai trò, mỗi vai trò chọn thể loại và số lượng)
  Bước 2: Khi nào? (ngày cụ thể, hoặc khoảng ngày linh hoạt)
  Bước 3: Ở đâu? (tỉnh/thành + khu vực chung + địa chỉ chi tiết — nói rõ địa chỉ chỉ lộ sau khi chọn)
  Bước 4: Ngân sách (tổng, hoặc tách theo từng vai trò)
  Bước 5: Mô tả concept + ảnh tham khảo
  Bước 6: Xem lại và đăng
  → Lưu nháp được ở mọi bước

Provider xem và chào:
  → Trang "Yêu cầu phù hợp" hiện các yêu cầu khớp vai trò, khu vực, sở trường của mình
  → Bộ lọc và sắp xếp
  → Xem chi tiết (ghi AuditLog)
  → Gửi đề nghị: lời nhắn, giá đề xuất, ngày đề xuất nếu khách để linh hoạt
  → Sửa hoặc rút đề nghị khi chưa được chấp nhận

Khách chọn:
  → Xem danh sách đề nghị, so sánh được: avatar, tên, thể loại sở trường, đánh giá, giá chào, lời nhắn
  → Bấm vào để xem hồ sơ đầy đủ
  → Nhắn tin với provider TRƯỚC khi quyết định
  → Chấp nhận → tạo Booking qua đúng transitionBooking hiện có, KHÔNG viết luồng booking riêng
  → Với yêu cầu nhiều vai trò: chấp nhận từng vai trò độc lập, yêu cầu chỉ FULFILLED khi đã đủ mọi vai trò
  → Các đề nghị còn lại cho vai trò đó tự chuyển DECLINED, gửi thông báo lịch sự

=== GIAO DIỆN CẦN LÀM ===
- /dashboard/requests — danh sách yêu cầu của khách, kèm số đề nghị nhận được
- /dashboard/requests/new — form tạo yêu cầu nhiều bước
- /dashboard/requests/[id] — chi tiết yêu cầu và danh sách đề nghị
- /dashboard/opportunities — trang provider xem yêu cầu phù hợp
- /dashboard/opportunities/[id] — chi tiết yêu cầu và form gửi đề nghị
- /dashboard/my-offers — các đề nghị provider đã gửi và trạng thái
- Thêm mục vào sidebar cho đúng từng vai trò
- Trang quản trị theo dõi yêu cầu chưa ai nhận

=== NGUYÊN TẮC KỸ THUẬT ===
- Booking tạo ra từ đề nghị được chấp nhận phải đi qua transitionBooking hiện có, KHÔNG tạo luồng song song
- Tận dụng hệ thống nhắn tin và thông báo sẵn có
- Tận dụng bảng ánh xạ vai trò-thể loại từ G2
- Cron: đóng yêu cầu quá hạn, nhắc khách khi có đề nghị mới, cảnh báo yêu cầu 48h chưa ai chào

=== TRƯỚC KHI CODE ===
Hãy trình bày cho tôi:
1. Sơ đồ trạng thái của ServiceRequest và RequestOffer
2. Cách xử lý yêu cầu nhiều vai trò khi chỉ một số vai trò có người nhận
3. Thuật toán ghép yêu cầu với provider phù hợp
4. Rủi ro nào bạn thấy mà tôi chưa nêu
CHỜ TÔI DUYỆT rồi mới code.
```

---

## PHẦN C — VIỆC BẠN CẦN QUYẾT

| # | Câu hỏi | Ảnh hưởng |
|---|---|---|
| 1 | **Avatar dùng chung cho mọi vai trò, hay mỗi hồ sơ một avatar?** | Chặn G2 |
| 2 | Giới hạn 5 thể loại sở trường có hợp lý không? | G2 |
| 3 | Xóa album thì ảnh bên trong xóa luôn hay chuyển về "Ảnh chưa phân loại"? | G3 |
| 4 | Provider chưa có đánh giá thì hiện gì thay cho "Mới (0)"? | G5 |
| 5 | **G7 có nên làm ngay không, hay đợi có đủ 50–100 provider?** | Quyết định lớn |

Về câu 5, ý kiến của tôi: mô hình yêu cầu chỉ chạy được khi có đủ provider để có người chào. Với số provider hiện tại, một yêu cầu đăng lên nhiều khả năng sẽ không ai nhận — và trải nghiệm đó tệ hơn cả việc không có tính năng. Tôi nghiêng về việc làm G1–G6 trước, nạp đủ provider, rồi mới mở G7.

---

*Đánh giá dựa trên file Excel đợt 2, 4 ảnh chụp màn hình nhúng, và schema từ fgrapher-context.md. Nhận định về nguyên nhân gốc là suy luận từ ảnh và schema — cần Claude Code xác nhận khi đọc code thật.*
