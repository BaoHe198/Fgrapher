# Kiểm toán quyền truy cập API, 16/11/2026

Phạm vi: toàn bộ 150 file `src/app/api/**/route.ts` và các service chúng gọi. Chỉ đọc
code; riêng các mục "Đã sửa" được kiểm tra lại bằng typecheck, 597 bài kiểm thử và
(mục 2) gọi thử trên server dev. Chưa rà: server component/server action ngoài
`src/app/api`, phần trong của `services/admin.ts`, `dashboard.ts`,
`product-reviews.ts`, `stock-alerts.ts`.

## Kết luận

Nền tảng ổn: mọi API cần đăng nhập đều gọi `requireAuth()` (có kiểm tra lại tài khoản
bị khoá/xoá), 21 API admin đều gọi `requireAdmin()`, 16 cron đều kiểm tra
`CRON_SECRET`, 3 webhook đều kiểm tra chữ ký, các API sau feature flag trả 404 khi cờ
tắt, không có chỗ nào nhận thẳng dữ liệu người dùng vào database mà thiếu schema. Hai
phát hiện của đợt kiểm toán trước (`prelaunch-audit-permissions.md`) đều đã được sửa.

Vấn đề thật nằm ở **dữ liệu trả về nhiều hơn mức cho phép**.

## Đã sửa trong đợt này

| #   | Mức           | Vấn đề                                                                                                                                                                                                                                               | Sửa                                                                                                                           |
| --- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | Cao           | `GET /api/opportunities/[id]?role=…`: vai trò lấy từ URL mà không kiểm tra, nên **bất kỳ tài khoản đã đăng nhập** đọc được toàn bộ một yêu cầu F Booking, kể cả địa chỉ chi tiết (`detailedAddress`) vốn chỉ được lộ sau khi đề xuất được chấp nhận. | `getOpportunityDetail` nay yêu cầu vai trò đang hoạt động và đã xác minh, và bỏ `detailedAddress`, `customerId` khỏi kết quả. |
| 2   | Cao           | `GET /api/saved-profiles` trả toạ độ chính xác (`latitude`/`longitude`) của nhà cung cấp cho bất kỳ ai lưu hồ sơ, dù `hideExactLocation` bật. Nơi khác toạ độ luôn được làm mờ hoặc làm tròn.                                                        | API bỏ `latitude`, `longitude`, `geocodeAddressHash`. Đã gọi thử: không còn trong kết quả.                                    |
| 3   | Trung bình    | Các API huỷ/từ chối/đổi lịch trả nguyên dòng booking: khách thấy email tài khoản của nhà cung cấp; nhà cung cấp thấy email, số điện thoại, địa chỉ của khách khi yêu cầu còn chờ.                                                                    | Thêm `bookingForViewer()` trong `services/bookings.ts`, áp dụng cho 3 chỗ trả booking sau khi thay đổi.                       |
| —   | Lỗi chức năng | Khi `MARKETPLACE_ENABLED=false`, đăng ký và thêm vai trò bị chặn cho cả Nhiếp ảnh gia, Quay phim, Studio (vì `SELLER_ROLES` được mở rộng ngày 21/09). Production đang bật marketplace nên chưa lộ ra.                                                | Chỉ chặn `CAMERA_SHOP`, đúng như thông báo lỗi và như `role-change-requests.ts` vẫn làm.                                      |

## Đợt sửa thứ hai (cùng ngày, chủ dự án đồng ý)

| #   | Mức                  | Vấn đề                                                                                                                                  | Sửa                                                                                                                                                                                                                                                                                                                               |
| --- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4   | Trung bình (tiềm ẩn) | Khi bắt đầu thu phí, nhà cung cấp hết hạn gói tự bật lại vai trò qua `POST /api/users/roles` rồi công khai lại hồ sơ mà không trả tiền. | Vai trò trả phí được tạo ở trạng thái chưa kích hoạt (như lúc đăng ký) và API không còn tự bật lại; chỉ có gói (miễn phí hay trả tiền) mới bật. `setProfilePublished` yêu cầu gói còn hiệu lực. Hành vi hiện tại (cấp gói miễn phí) không đổi.                                                                                    |
| 5   | Thấp                 | Đổi email (có hỏi mật khẩu) ghi thẳng email mới, không xác minh.                                                                        | Cột mới `User.pendingEmail` (migration `20261116130000_add_user_pending_email`). Email mới chỉ thay vào sau khi bấm link gửi tới chính địa chỉ đó; trước đó vẫn đăng nhập bằng email cũ, nên gõ nhầm không bị khoá tài khoản. Báo ngay nếu email đã có người dùng, và kiểm tra lại lúc bấm link. Đã thử đủ luồng trên server dev. |
| 6   | Thấp                 | `PATCH /api/albums/[id]` nhận `coverMediaId` bất kỳ.                                                                                    | Ảnh bìa phải là ảnh (chưa xoá) của chính album đó.                                                                                                                                                                                                                                                                                |
| 7   | Thấp                 | Hồ sơ xác minh danh tính nhận `publicId` không thuộc thư mục KYC của người gửi.                                                         | `isOwnKycAsset()`: mã ảnh phải nằm trong `fgrapher-kyc/<userId>/` và URL phải trỏ đúng ảnh đó (cùng giả định thư mục mà kiểm tra ảnh portfolio đang dùng).                                                                                                                                                                        |
| 8   | Thấp                 | `GET /api/products/[id]` không cần đăng nhập, trả cả sản phẩm chưa bật và ảnh chưa duyệt.                                               | Chỉ người bán của sản phẩm đó đọc được; người khác nhận 404 như sản phẩm không tồn tại. Không trang nào trong web gọi API này.                                                                                                                                                                                                    |

Tất cả 8 phát hiện của đợt kiểm toán này đã được sửa.
