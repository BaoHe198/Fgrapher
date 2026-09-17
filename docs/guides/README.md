# Hướng dẫn lịch sử xây dựng Fgrapher

Thư mục này lưu kế hoạch và prompt từng dùng để xây dự án qua nhiều giai đoạn. Nó
giúp hiểu ý định ban đầu và lý do một số quyết định được đưa ra.

**Không dùng guide Phase làm nguồn hiện trạng.** Nhiều nội dung đã thay đổi, ví dụ:

- Stripe bị tắt theo điều kiện kinh doanh tại Việt Nam;
- messaging dùng polling thay vì Socket.io;
- marketplace và social feed nằm sau feature flag;
- dự án đã có thêm Model, thanh toán Việt Nam, outbox email, cache và nhiều chốt bảo
  mật không có trong kế hoạch ban đầu.

Nguồn hiện hành:

1. `CLAUDE.md`: ràng buộc bắt buộc.
2. `docs/FEATURES.md`: tính năng đang có.
3. `docs/ARCHITECTURE.md`: kiến trúc hiện tại.
4. `docs/MVP_SCOPE.md`: phạm vi đang bật/tắt.
5. `docs/ops`: vận hành production.
6. Code và test: nguồn quyết định cuối cùng.

## Danh sách giai đoạn

| Giai đoạn | Mục tiêu lịch sử                         | File                       |
| --------- | ---------------------------------------- | -------------------------- |
| 1         | Landing page, navigation và design token | `phase-1-landing-nav.md`   |
| 2         | Đăng nhập, đăng ký và quên mật khẩu      | `phase-2-auth.md`          |
| 3         | Khung dashboard và các khu quản lý       | `phase-3-dashboard.md`     |
| 4         | Hồ sơ công khai và portfolio             | `phase-4-profiles.md`      |
| 5         | Tìm kiếm và khám phá nhà cung cấp        | `phase-5-browse-search.md` |
| 6         | Đặt lịch và lịch rảnh                    | `phase-6-booking.md`       |
| 7         | Gói và thanh toán                        | `phase-7-payments.md`      |
| 8         | Tin nhắn                                 | `phase-8-messaging.md`     |
| 9         | Marketplace thiết bị                     | `phase-9-marketplace.md`   |
| 10        | Đánh giá                                 | `phase-10-reviews.md`      |
| 11        | i18n, hiệu năng, SEO và accessibility    | `phase-11-polish.md`       |
| 12        | Admin và chuẩn bị ra mắt                 | `phase-12-admin-launch.md` |

## Cách đọc một guide cũ

Mỗi guide đã được viết lại bằng tiếng Việt theo bốn phần:

1. mục tiêu;
2. những thành phần đã dự kiến;
3. kiến thức kỹ thuật cần hiểu;
4. điểm nào đã thay đổi so với hiện trạng.

Tên file, route, API và biến môi trường được giữ nguyên để tra cứu code. Những đoạn
prompt dài bằng tiếng Anh trước đây đã được rút thành yêu cầu rõ ràng; Git vẫn giữ
lịch sử nếu cần xem nguyên bản.

## Tóm tắt hệ thống thiết kế

- Xanh rừng là màu chính; vàng ấm là màu nhấn.
- Nền trắng/kem ấm, dark mode có palette riêng.
- Bề rộng nội dung lớn nhất khoảng 1240 px.
- Navigation cao khoảng 72 px.
- Dashboard sidebar khoảng 232 px; browse filter khoảng 268 px.
- Card bo 12–16 px; button/badge thường bo nhiều.
- Bricolage Grotesque cho display; Plus Jakarta Sans cho nội dung.

Giá trị chính xác nằm trong `docs/design-reference/design-tokens.md` và
`src/app/globals.css`.

## Khi giao việc cho Claude Code

Một task tốt nên có:

- vấn đề hiện tại và cách tái hiện;
- hành vi mong đợi;
- file hoặc luồng liên quan;
- ràng buộc không được phá;
- kiểm tra cần chạy;
- yêu cầu báo cáo file thay đổi và rủi ro.

Ví dụ:

```text
Lỗi: khi bấm nhiều bộ lọc liên tiếp ở /browse, lựa chọn trước bị mất.

Hãy lần theo state và router navigation trong filter sidebar, sửa để các lần cập
nhật nhanh được gộp đúng. Giữ URL là nguồn có thể chia sẻ, không tăng số request
không cần thiết. Thêm kiểm tra tập trung cho click liên tiếp và chạy lint,
typecheck, test liên quan.
```

Tránh prompt quá rộng như “làm toàn bộ phase” vì khó review và dễ sửa ngoài phạm
vi. Chia theo hành vi có thể kiểm tra.

## Quy trình dùng tài liệu lịch sử an toàn

1. Đọc mục tiêu trong guide.
2. So với `docs/FEATURES.md` và code hiện tại.
3. Bỏ yêu cầu đã lỗi thời.
4. Tạo task nhỏ, có tiêu chí hoàn thành.
5. Review diff và chạy kiểm tra.
6. Cập nhật tài liệu hiện hành, không chỉ guide lịch sử.
