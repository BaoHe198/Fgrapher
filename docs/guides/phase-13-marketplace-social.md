# Kế hoạch: Chợ F (Marketplace) và Cộng đồng F (Social)

Ngày lập: 21/09/2026. Người quyết định: chủ dự án. Thứ tự đã chốt: **làm Chợ
trước, Cộng đồng sau**.

Tài liệu này mô tả việc cần làm, không phải việc đã làm. Trạng thái hiện tại
nằm ở mục 2.

## 1. Vì sao làm bây giờ

Vai trò **Shop cho thuê trang phục** (`COSTUME_SHOP`, thêm ngày 21/09/2026) cần
đăng từng bộ trang phục để khách thuê, không chỉ nhận đặt lịch. Đó là lý do trực
tiếp mở lại phần Chợ. Cộng đồng làm sau để giữ người dùng quay lại.

Hai mục menu "Chợ F" và "Cộng đồng F" đã có sẵn tên nhưng **chưa hiện**, chỉ bật
khi phần tương ứng chạy được.

## 2. Hiện trạng

### Chợ — đã có sẵn nhưng đang tắt

Toàn bộ nằm sau cờ `MARKETPLACE_ENABLED=false`:

| Đã có                            | Ghi chú                                    |
| -------------------------------- | ------------------------------------------ |
| Bảng `Product`, `ProductImage`   | Có sẵn `rentalPrice` (giá/ngày) và `depositAmount` |
| Bảng `Order`, `OrderItem`, `CartItem` | `OrderStatus`: PENDING → CONFIRMED → SHIPPED → DELIVERED → CANCELLED/RETURNED |
| Trang `/shop`, `/shop/[id]`, `/cart`, `/checkout` | Giao diện đã dựng |
| API sản phẩm, giỏ hàng, đơn hàng | `src/app/api/products`, `/cart`, `/orders` |
| Bảng điều khiển: Tin đăng, Đơn hàng cửa hàng | `/dashboard/listings`, `/dashboard/shop-orders` |

### Chợ — chưa có, hoặc không dùng được

- **Thanh toán đi qua Stripe** (`createCheckoutSessionForCart`). Stripe không mở
  tài khoản cho doanh nghiệp Việt Nam (ràng buộc #1 trong CLAUDE.md), nên toàn bộ
  chân thanh toán phải làm lại.
- **Không có luồng thuê theo ngày**: `Order` chưa có ngày bắt đầu/kết thúc thuê,
  chưa có hạn trả, chưa có trạng thái "đang thuê".
- **Không kiểm tra trùng lịch thuê**: hai khách có thể thuê cùng một bộ đồ cùng ngày.
- **Chưa có phí giao hàng, chưa có địa chỉ nhận hàng.**
- Sản phẩm mới chỉ hợp với cửa hàng máy ảnh (`category` là chuỗi tự do: camera,
  lens...), chưa gắn với 8 thể loại trang phục.
- Ảnh sản phẩm **chưa qua kiểm duyệt** như ảnh portfolio.
- Chưa có đánh giá sản phẩm/shop, chưa có thông báo đơn hàng.

### Đã làm xong (cập nhật 21/09/2026)

- **Bỏ Stripe khỏi luồng đặt đơn**: đặt đơn bằng `placeOrdersFromCart()`, đơn
  tạo ở trạng thái chờ, **shop tự thu tiền cọc** (quyết định của chủ dự án) —
  nền tảng chỉ ghi nhận, không giữ tiền. Code Stripe cũ còn nguyên sau cờ.
- **Thuê theo ngày**: `OrderItem` đã có `rentalStart`/`rentalEnd`/`returnedAt`;
  hai khách không thuê được cùng một món trùng ngày (`findRentalConflicts`).
- **Trạng thái thuê**: thêm `PICKED_UP` (khách đã lấy) và `OVERDUE` (quá hạn
  trả). Quá hạn do cron `/api/cron/flag-overdue-rentals` đặt lúc 2h sáng, không
  ai bấm tay.
- **Luật chuyển trạng thái đơn**: trước đây đơn nhảy từ trạng thái nào sang
  trạng thái nào cũng được; nay đi qua bảng `VALID_ORDER_TRANSITIONS` trong
  `src/lib/order-status.ts`, giống cách booking làm.
- **Phí trễ / hư hỏng**: ghi nhận số tiền trên đơn (`lateFeeAmount`,
  `damageFeeAmount`, `returnNote`), không tự động trừ tiền ai.
- **Sản phẩm trang phục**: đã có 8 thể loại riêng cho shop trang phục.

Còn lại của 13A: phí giao hàng, kiểm duyệt ảnh sản phẩm, đánh giá sản phẩm,
trang shop, thông báo đơn hàng, đăng ký Bộ Công Thương, bật cờ trên Vercel.

### Cộng đồng — gần như chưa có

| Đã có                                    | Chưa có                                              |
| ---------------------------------------- | ---------------------------------------------------- |
| Bảng `Post`, `PostMedia`, `Like`, `Comment`, `Follow` | API bài đăng, trang bảng tin, màn soạn bài, hiển thị bài trên hồ sơ |
| API theo dõi (`/api/follows`)            | Thích, bình luận, thông báo, kiểm duyệt, chống spam   |

## 3. Giai đoạn 13A — Chợ F

Thứ tự dưới đây là thứ tự làm. Mỗi bước phải chạy được và kiểm thử được trước khi
sang bước sau.

### 13A.1 Thanh toán (việc lớn nhất)

Bỏ Stripe khỏi luồng đơn hàng, thay bằng đúng các rail đã có cho gói thuê bao
(`src/services/payments.ts`): **MoMo, ZaloPay, chuyển khoản ngân hàng xác nhận thủ
công**, cộng thêm **COD/trả khi nhận** cho đơn giao tận nơi.

- Mỗi cách thanh toán nằm sau cờ riêng như hiện nay; tất cả tắt thì đơn hàng vẫn
  tạo được ở trạng thái "chờ thanh toán" và shop tự xác nhận.
- Thêm bảng `OrderPayment` (số tiền, cách trả, trạng thái, mã giao dịch) thay vì
  nhét vào `Order`, để một đơn có thể có tiền cọc và tiền thuê trả hai lần.
- **Quyết định cần chủ dự án**: có giữ tiền cọc qua nền tảng không, hay shop tự
  thu? Giữ hộ tiền là hoạt động trung gian thanh toán, cần giấy phép riêng.

### 13A.2 Thuê theo ngày

- `OrderItem` thêm `rentalStart`, `rentalEnd`, `returnedAt`.
- Chặn trùng: một bộ đồ đang thuê thì không nhận đơn chồng ngày. Dùng lại cách
  kiểm tra trùng giờ của booking (`services/availability.ts`).
- Trạng thái đơn bổ sung cho thuê: `PICKED_UP` (khách đã lấy) và `OVERDUE` (quá hạn trả).
- Phí trễ và mất/hỏng: chỉ ghi nhận số tiền, không tự trừ tiền.

### 13A.3 Sản phẩm cho shop trang phục

- `Product.category` chuyển sang dùng enum `ProfileCategory` phần trang phục
  (Áo dài, Váy cưới, Vest & đồ nam, Dạ hội, Cổ trang, Cosplay, Trẻ em, Phụ kiện).
- Thêm trường size, màu, tình trạng đồ.
- Quyền đăng sản phẩm: `CAMERA_SHOP` và `COSTUME_SHOP` (hiện API chỉ cho phép
  `CAMERA_SHOP`).

### 13A.4 Giao nhận

- Hai lựa chọn: **tự đến lấy tại shop** (dùng địa chỉ trong hồ sơ, đã có trên Fmap)
  và **giao tận nơi** (khách nhập địa chỉ, shop tự tính phí).
- Không tích hợp hãng vận chuyển ở bước này.

### 13A.5 Kiểm duyệt và an toàn

- Ảnh sản phẩm đi qua đúng luồng kiểm duyệt như ảnh portfolio.
- Cấm các mặt hàng không phù hợp; thêm lý do báo cáo cho sản phẩm.
- Shop phải xác minh danh tính trước khi đăng bán, giống mọi vai trò provider.

### 13A.6 Hoàn thiện trải nghiệm

- Trang Chợ: tìm theo tỉnh/thành, phường/xã, thể loại, khoảng giá, cho thuê/bán.
- Trang của từng shop (gộp với hồ sơ provider sẵn có).
- Đánh giá sau khi trả đồ, dùng lại hệ thống đánh giá của booking.
- Thông báo và email cho: đơn mới, xác nhận, nhắc trả đồ, quá hạn.

### 13A.7 Pháp lý (cần người thật, không phải code)

- Website bán hàng tại Việt Nam phải **thông báo/đăng ký với Bộ Công Thương**.
  Đây là nghĩa vụ của chủ dự án, cần luật sư xác nhận trước khi bật cờ.
- Cần có: chính sách đổi trả, chính sách vận chuyển, điều khoản cho thuê, cách
  xử lý mất/hỏng đồ, xuất hoá đơn.

### 13A.8 Bật và kiểm thử

- Test tự động cho: trùng lịch thuê, tính tiền, chuyển trạng thái đơn.
- Chạy thử toàn luồng trên dev bằng tài khoản shop mẫu.
- Bật cờ ở Preview trước, production sau; thêm mục "Chợ F" vào menu khi bật.

## 4. Giai đoạn 13B — Cộng đồng F

1. **API bài đăng**: tạo/sửa/xoá, tối đa N ảnh, mô tả, gắn hồ sơ provider.
2. **Bảng tin**: hai tab "Đang theo dõi" và "Khám phá", phân trang kiểu cuộn vô hạn
   bằng con trỏ (không dùng offset, tránh chậm khi dữ liệu lớn).
3. **Tương tác**: thích, bình luận, chống spam bằng giới hạn số lần.
4. **Kiểm duyệt**: ảnh qua kiểm duyệt như portfolio; nút báo cáo; hàng chờ cho admin.
5. **Thông báo**: có người thích, bình luận, theo dõi mình.
6. **Trên hồ sơ**: tab bài đăng của provider.
7. **Hiệu năng**: đếm lượt thích/bình luận lưu sẵn, không đếm lại mỗi lần tải.

Ràng buộc giữ nguyên: **không có danh mục hay nội dung nude/sexy/boudoir**
(CLAUDE.md, ràng buộc #3).

## 5. Ước lượng

Tính theo phiên làm việc thực tế (mỗi phiên vài giờ, có AI local hỗ trợ các phần
nhỏ):

| Phần                          | Ước lượng    |
| ----------------------------- | ------------ |
| 13A.1 Thanh toán              | 3–4 phiên    |
| 13A.2 Thuê theo ngày          | 2–3 phiên    |
| 13A.3 Sản phẩm trang phục     | 1–2 phiên    |
| 13A.4 Giao nhận               | 1 phiên      |
| 13A.5 Kiểm duyệt              | 1 phiên      |
| 13A.6 Trải nghiệm             | 2–3 phiên    |
| 13A.8 Kiểm thử & bật          | 1–2 phiên    |
| **Chợ — tổng**                | **11–16 phiên** |
| 13B Cộng đồng                 | 6–9 phiên    |

Chưa tính phần pháp lý và thời gian chờ đăng ký với Bộ Công Thương.

## 6. Rủi ro chính

1. **Thanh toán**: nếu giữ tiền hộ, phạm vi pháp lý rộng hơn nhiều. Cách an toàn
   là shop tự thu, nền tảng chỉ ghi nhận.
2. **Mở lại Chợ kéo theo cửa hàng máy ảnh** (`CAMERA_SHOP`) vốn nằm ngoài MVP.
   Cần quyết định: mở cho cả hai, hay chỉ cho shop trang phục trước.
3. **Kiểm duyệt nội dung** tăng tải cho admin khi có cả sản phẩm lẫn bài đăng.
4. **Tranh chấp thuê đồ** (mất, hỏng, trả trễ) là việc vận hành, không giải quyết
   được bằng code; cần quy trình và điều khoản rõ.
