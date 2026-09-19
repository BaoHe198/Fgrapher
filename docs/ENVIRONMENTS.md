# Các môi trường của Fgrapher

Tài liệu này giải thích code và dữ liệu đang chạy ở đâu. Nếu mới làm quen dự án,
hãy nhớ quy tắc quan trọng nhất: **local/Preview dùng database dev; production dùng
database riêng**.

## 1. Sơ đồ hiện tại

Fgrapher có hai database Supabase:

| Môi trường | Nơi chạy                        | Database        | Dùng để làm gì?                         |
| ---------- | ------------------------------- | --------------- | --------------------------------------- |
| Local      | Máy lập trình viên              | `fgrapher-dev`  | Viết code và thử nhanh                  |
| Preview    | Vercel, mỗi nhánh/PR có một URL | `fgrapher-dev`  | Cho người khác xem và kiểm tra thay đổi |
| Production | Vercel, nhánh `master`          | `fgrapher-prod` | Website thật và dữ liệu người dùng thật |

Local và Preview là hai nơi chạy khác nhau nhưng dùng chung database dev. Vì vậy
dữ liệu thử của một nhánh có thể xuất hiện ở nhánh khác. Đây là đánh đổi được chấp
nhận khi dự án còn do một người vận hành.

Dự án chưa có database staging riêng. Nếu đội phát triển lớn hơn hoặc cần kiểm thử
trên dữ liệu tách biệt hoàn toàn, có thể bổ sung sau.

## 2. File và nơi lưu biến môi trường

- `.env`: Prisma CLI đọc khi generate hoặc chạy migration.
- `.env.local`: Next.js đọc khi chạy local.
- Vercel Preview scope: cấu hình cho mọi nhánh không phải `master`.
- Vercel Production scope: cấu hình website thật.

Không tạo hoặc commit `.env.production`. Secret production chỉ được lưu trong
dashboard Vercel hoặc dịch vụ quản lý secret phù hợp.

## 3. Những biến quan trọng

| Biến                                           | Dev/Preview                             | Production                       | Có bí mật?                                            |
| ---------------------------------------------- | --------------------------------------- | -------------------------------- | ----------------------------------------------------- |
| `DATABASE_URL`                                 | Kết nối pool tới `fgrapher-dev`         | Kết nối pool tới `fgrapher-prod` | Có                                                    |
| `DIRECT_URL`                                   | Kết nối trực tiếp tới dev               | Kết nối trực tiếp tới production | Có                                                    |
| `NEXTAUTH_SECRET`                              | Khoá riêng cho dev                      | Khoá khác hoàn toàn dev          | Có                                                    |
| `NEXTAUTH_URL`                                 | `http://localhost:3000` khi chạy local  | URL website thật                 | Không                                                 |
| `APP_ENV`                                      | `development`                           | `production`                     | Không                                                 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`    | OAuth app thử nghiệm hoặc để trống      | OAuth app production             | Secret là bí mật                                      |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`            | Cloud dev hoặc dùng thư mục dev         | Cloud/thư mục production         | Không                                                 |
| `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Credential dev                          | Credential production            | Secret là bí mật                                      |
| `RESEND_API_KEY`                               | Có thể để trống để không gửi thật       | Khoá gửi email thật              | Có                                                    |
| `MAPTILER_API_KEY`                             | Có thể để trống; provider chưa lên Fmap | Khoá MapTiler thật để lấy tọa độ | Có                                                    |
| `NEXT_PUBLIC_MAP_STYLE_URL`                    | Để trống: dùng OpenFreeMap miễn phí     | URL style bản đồ trả phí nếu cần | Không                                                 |
| `CRON_SECRET`                                  | Tuỳ nhu cầu local                       | Bắt buộc                         | Có                                                    |
| `NEXT_PUBLIC_SENTRY_DSN`                       | Có thể dùng project dev                 | Project production               | Không phải secret, nhưng phải đúng project/môi trường |
| `NEXT_PUBLIC_APP_URL`                          | `http://localhost:3000`                 | URL website thật                 | Không                                                 |

Các biến thanh toán và feature flag nằm trong `.env.example` và `src/lib/env.ts`.
Stripe, MoMo, ZaloPay và chuyển khoản chỉ được bật khi chủ dự án đã hoàn tất điều
kiện kinh doanh, credential và quy trình vận hành tương ứng.

Tiền tố `NEXT_PUBLIC_` nghĩa là giá trị có thể được gửi xuống trình duyệt. Không
bao giờ đặt mật khẩu, API secret hoặc khoá riêng vào biến có tiền tố này.

## 4. Hành vi khác nhau theo `APP_ENV`

- Môi trường không phải production hiển thị thanh cảnh báo để tránh nhầm dữ liệu.
- Analytics chỉ nên thu dữ liệu thật ở production.
- Email ở local/Preview nên tắt hoặc chuyển về hộp thư thử nghiệm.
- Credential test và live của cổng thanh toán không được dùng lẫn nhau.
- Mã bỏ qua dành cho dev, dữ liệu seed và tài khoản thử không được hoạt động ở
  production.

## 5. Bảo vệ database

`scripts/check-db-safety.mjs` kiểm tra database trước các lệnh có thể thay đổi
schema hoặc xoá dữ liệu. Lệnh dev chỉ được phép chạy với project ref nằm trong danh
sách an toàn. Production không được thêm vào danh sách đó.

Trước khi chạy migration hoặc reset:

1. Đọc lại `DATABASE_URL` và `DIRECT_URL` đang trỏ tới đâu.
2. Xác nhận thanh môi trường không ghi production.
3. Không bỏ qua script an toàn khi nó từ chối.
4. Với production, chỉ chạy quy trình deploy migration đã được duyệt.

Xem thêm `docs/MIGRATIONS.md` và `docs/ops/VAN-HANH-PRODUCTION.md`.
