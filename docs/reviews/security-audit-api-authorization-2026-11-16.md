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

## Còn mở, cần quyết định hoặc làm sau

| #   | Mức                  | Vấn đề                                                                                                                                                                                                                          | Đề xuất                                                                                           |
| --- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 4   | Trung bình (tiềm ẩn) | Chỉ khi bắt đầu thu phí (`FREE_ROLE_GRANT_ENABLED=false`): nhà cung cấp hết hạn gói có thể tự bật lại vai trò qua `POST /api/users/roles` rồi công khai lại hồ sơ mà không trả tiền (`setProfilePublished` không kiểm tra gói). | Sửa trước khi bật thu phí: chỉ kích hoạt vai trò khi có gói, và kiểm tra gói khi công khai hồ sơ. |
| 5   | Thấp                 | `PATCH /api/users/me` cho đổi email (có hỏi mật khẩu) nhưng không xác minh email mới và giữ nguyên trạng thái "đã xác minh".                                                                                                    | Đổi email thì gửi link xác minh tới địa chỉ mới. Đổi hành vi nên cần chủ dự án đồng ý.            |
| 6   | Thấp                 | `PATCH /api/albums/[id]` nhận `coverMediaId` bất kỳ, không kiểm tra ảnh thuộc album đó.                                                                                                                                         | Kiểm tra ảnh thuộc cùng album/hồ sơ.                                                              |
| 7   | Thấp (chưa chắc)     | Hồ sơ xác minh danh tính lưu `publicId` Cloudinary mà không kiểm tra nằm trong thư mục KYC của chính người gửi.                                                                                                                 | Từ chối `publicId` không bắt đầu bằng thư mục KYC của người gửi.                                  |
| 8   | Thấp                 | `GET /api/products/[id]` không cần đăng nhập, trả cả sản phẩm chưa bật và ảnh chưa duyệt (chỉ khi marketplace bật).                                                                                                             | Yêu cầu đăng nhập và là chủ sản phẩm.                                                             |
