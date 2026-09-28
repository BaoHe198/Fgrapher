# Báo cáo lịch sử: tuân thủ và dữ liệu nhạy cảm trước khi ra mắt

> Đây là audit kỹ thuật, không phải ý kiến pháp lý. Các luật, thời hạn lưu dữ liệu,
> consent và nội dung chính sách phải được luật sư xác nhận. Nhiều phát hiện trong
> báo cáo đã có thể được sửa sau thời điểm audit.

## 1. Những ràng buộc đã kiểm tra

| Ràng buộc                      | Điều audit muốn chứng minh                                 |
| ------------------------------ | ---------------------------------------------------------- |
| Stripe không dùng ở Việt Nam   | Code cũ nằm sau flag, không có đường thu tiền ngoài ý muốn |
| Chưa có cổng thanh toán online | Gói được cấp thủ công/miễn phí theo policy                 |
| Không có category người lớn    | Enum, UI và API không tạo lối đi vòng                      |
| Mọi tài khoản đủ 18 tuổi       | Tất cả cách đăng ký đều có age gate server-side            |
| Nhà cung cấp phải xác minh     | Không publish profile trước verification                   |
| Consent theo mục đích          | Không gộp/tick sẵn; có thời gian, phiên bản và IP          |
| KYC không công khai            | Storage riêng, signed URL ngắn, mỗi lần xem có audit       |
| Portfolio phải kiểm duyệt      | Chỉ media approved xuất hiện công khai                     |
| Không hardcode tỉnh/thành      | Dữ liệu địa lý lấy từ database/API                         |
| Giao diện Việt Nam             | VND, ngày giờ và nhãn theo locale/múi giờ quy định         |

## 2. Phát hiện quan trọng lúc audit

### Google OAuth từng đi vòng age gate và consent

Đăng ký bằng credentials kiểm tra ngày sinh ≥18 ở server. Google OAuth lúc đó tạo
User trực tiếp qua adapter nhưng không nhận ngày sinh, không có onboarding bắt buộc
bổ sung và không ghi consent tương đương.

Bài học: mọi entry point tạo tài khoản phải đi qua cùng policy, hoặc tài khoản OAuth
phải ở trạng thái chưa hoàn tất cho tới khi người dùng cung cấp ngày sinh và đồng ý
từng mục đích.

### Publish profile được bảo vệ tốt

Service publish là đường ghi chính cho `isPublished` và kiểm tra:

- UserRole đã xác minh;
- có media được duyệt;
- người gọi sở hữu role/profile.

Audit còn thử đưa `isPublished` qua endpoint sửa hồ sơ chung và không vượt được
validation. Đây là mẫu tốt: giữ một đường ghi và bảo vệ ở service.

### Consent cần được kiểm tra ở mọi luồng

Checkbox phải tách theo mục đích, không tick sẵn và server ghi thời gian/phiên bản.
Lỗ hổng OAuth ở trên cũng là lỗ hổng consent vì đường tạo tài khoản thứ hai không đi
qua form credentials.

### Danh sách tỉnh từng còn hardcode

Phần lớn hệ thống dùng Province/Ward từ database, nhưng filter browse từng có mảng
thành phố viết trực tiếp. Hardcode gây lệch tên/mã và khó cập nhật sau thay đổi hành
chính.

### Định dạng Việt Nam bị dùng không nhất quán

`src/lib/format.ts` là nguồn chung cho VND, ngày, giờ và múi giờ. Audit tìm thấy
nhiều nơi gọi `toLocaleString` hoặc `toLocaleDateString("en-US")` trực tiếp, tạo
ngày kiểu Mỹ/tiếng Anh và có thể lệch múi giờ.

Role/category/experience label cũng từng lấy map tiếng Anh thay vì i18n. Cách sửa là
dùng helper format chung và key dịch, sau đó có test/scan ngăn tái phát.

## 3. Rà soát dữ liệu nhạy cảm

### Số điện thoại và địa chỉ booking

Trang hồ sơ/search công khai không trả số điện thoại. Booking detail che
`contactPhone` và `locationAddress` trước khi đủ điều kiện. Tuy nhiên endpoint
danh sách/calendar lúc audit dùng include rộng và chưa áp cùng phép che, khiến nhà
cung cấp có thể thấy thông tin sớm hơn trang detail.

Quy tắc phải nằm trong mapper/select dùng chung cho mọi endpoint, không chỉ component
hoặc một route.

### Ngày sinh

Trang profile Model chỉ nên hiển thị nhóm tuổi như “25–34”, không trả ngày sinh
chính xác. Audit không thấy leak đang hoạt động nhưng phát hiện
`getPublicProfileUser` từng query User bằng include rộng. Nếu sau này spread object
đó sang Client Component, password hash/email/phone/ngày sinh có thể bị serialize.

Phòng ngừa: dùng `select` allow-list ngay tại query.

### Thư điện tử (email)

Public profile, search, metadata, sitemap không chủ ý công khai email. Trong booking,
hai bên từng nhận email của nhau ngay cả lúc pending. Đây là quyết định sản phẩm cần
chốt: email có phải thông tin liên hệ chỉ mở sau xác nhận giống phone/address không?

### Ảnh KYC

Đây là phần được bảo vệ tốt tại thời điểm audit:

- Cloudinary authenticated asset, không có public URL;
- chỉ route admin chuyên dụng tạo signed URL;
- mỗi lần xem gọi service ghi audit;
- danh sách KYC không trả URL ảnh;
- cron xoá tài liệu hết retention.

Vẫn phải kiểm tra cấu hình vùng lưu dữ liệu và căn cứ pháp lý ngoài code.

## 4. Phương pháp chống lộ dữ liệu

1. Viết `select` allow-list gần database.
2. Tạo DTO/mapper riêng cho public, participant và admin.
3. Không trả nguyên object Prisma sang Client Component.
4. Kiểm tra các endpoint “anh em” cùng đọc một model.
5. Test User A truy cập resource User B.
6. Quét response/page payload, metadata, JSON-LD, sitemap và log.
7. Dùng signed URL sống ngắn cho tài liệu nhạy cảm.
8. Ghi audit cho hành động xem/sửa/xoá.

## 5. Phần audit cũ chưa bao phủ hết

- Mọi đường ghi `moderationStatus`.
- Toàn bộ field trong tất cả route admin.
- Server Action ngoài `src/app/api`.
- Cấu hình thực tế của Cloudinary/Supabase/Resend.
- Nội dung pháp lý và việc đăng ký website.

## 6. Checklist trước launch

- [ ] Luật sư duyệt điều khoản, quyền riêng tư, consent và retention.
- [ ] OAuth và credentials đều thực thi age gate/consent.
- [ ] Public query dùng allow-list.
- [ ] Booking list/detail/calendar che dữ liệu cùng quy tắc.
- [ ] KYC URL ngắn hạn và audit mọi lần xem.
- [ ] UI tiếng Việt, VND và Asia/Ho_Chi_Minh nhất quán.
- [ ] Media công khai chỉ gồm nội dung approved.
- [ ] Feature flag được kiểm tra ở server.
- [ ] Có quy trình yêu cầu truy cập/xuất/xoá dữ liệu.

Xem `docs/ops/Fgrapher-checklist-viec-thu-cong.xlsx` cho các việc chủ dự án và luật
sư còn phải làm.
