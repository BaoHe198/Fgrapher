# Rà soát 20 hạng mục bảo mật trước khi public

Ngày rà soát: 23/09/2026  
Nhánh: `fix/security-foundation`

Tài liệu này ghi trạng thái thực tế của 20 mục trong checklist “tự thử phá web
của mình”. “Xong trong code” không có nghĩa là production đã được cấu hình; các
mục liên quan Supabase, Vercel, Cloudflare, Sentry và backup phải được kiểm tra
trên dashboard tương ứng.

## Trạng thái

|   # | Hạng mục                            | Trạng thái               | Kết quả và việc còn lại                                                                                                                                                                                                   |
| --: | ----------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | Hash mật khẩu bằng Argon2/bcrypt    | Xong trong code          | Dự án dùng `bcryptjs`; không lưu mật khẩu thô.                                                                                                                                                                            |
|   2 | Rate limit đăng nhập                | Một phần                 | Có giới hạn theo IP và email, đồng thời có mức trần chung cho API. Bộ đếm hiện nằm trong RAM của từng instance nên chưa chống được tấn công phân tán qua nhiều instance. Cần Redis/KV hoặc dịch vụ rate-limit dùng chung. |
|   3 | Session phải hết hạn                | Xong trong code          | JWT session được khai báo rõ thời hạn 30 ngày, không còn phụ thuộc mặc định ẩn của Auth.js.                                                                                                                               |
|   4 | Xóa debug log thừa                  | Đạt                      | Không thấy log debug chứa secret/dữ liệu người dùng. Các `console.error` còn lại phục vụ vận hành và tránh ghi secret.                                                                                                    |
|   5 | Secret không nằm ở frontend         | Đạt                      | Secret dùng biến server; các biến `NEXT_PUBLIC_*` chỉ chứa dữ liệu được phép công khai.                                                                                                                                   |
|   6 | Không trả lỗi nội bộ cho người dùng | Đạt với luồng đã rà      | API dùng lỗi tổng quát cho exception không xác định. Nội dung lỗi trực tiếp từ MoMo/ZaloPay đã được giữ ở log server và đổi thành mã công khai cố định.                                                                   |
|   7 | Giới hạn loại file upload           | Xong trong code          | Server xác minh loại tài nguyên và định dạng thật trên Cloudinary trước khi lưu.                                                                                                                                          |
|   8 | Giới hạn dung lượng file            | Xong trong code          | Server kiểm tra số byte thật sau upload cho portfolio, sản phẩm, avatar/cover, yêu cầu, booking, cộng đồng, chat và biên lai.                                                                                             |
|   9 | Validate lại ở server               | Đạt                      | Các API chính dùng Zod và các service kiểm tra lại quyền sở hữu, trạng thái nghiệp vụ và metadata upload.                                                                                                                 |
|  10 | Đổi `/user/123` thành `/user/124`   | Đã vá các luồng nhạy cảm | Booking/order/offer đã có ownership guard. Đã vá hai IDOR thật: chèn `bookingId` lạ qua chat và xem yêu cầu chưa được admin duyệt qua URL trực tiếp. Nên chạy pentest/E2E quyền định kỳ khi thêm API mới.                 |
|  11 | User thường không vào admin         | Đạt                      | Route và service admin dùng kiểm tra quyền admin ở server.                                                                                                                                                                |
|  12 | Query DB phải parameterized         | Đạt                      | Prisma tạo query có tham số; không thấy ghép chuỗi SQL từ input người dùng.                                                                                                                                               |
|  13 | Bắt buộc HTTPS                      | Xong trong code/nền tảng | Vercel phục vụ HTTPS; response có HSTS `max-age=15552000; includeSubDomains`. Cần kiểm tra lại trên domain production sau deploy.                                                                                         |
|  14 | Security headers                    | Đạt, còn nợ CSP          | Có CSP, nosniff, chống iframe, referrer policy và permissions policy. CSP vẫn cần `'unsafe-inline'` cho Next.js/next-themes; chuyển sang nonce là dự án riêng vì ảnh hưởng render/cache.                                  |
|  15 | Cookie HttpOnly + Secure + SameSite | Đạt theo Auth.js         | Auth.js quản lý session cookie và tự bật cookie Secure trên HTTPS; cần xác nhận một lần bằng DevTools trên domain production. Cookie locale không chứa dữ liệu đăng nhập và dùng SameSite=Lax.                            |
|  16 | CORS chỉ cho domain cần thiết       | Một phần                 | API ứng dụng cùng origin, CSP giới hạn kết nối trình duyệt. Cần kiểm tra “Allowed origins” trong Cloudinary dashboard khi có domain chính thức.                                                                           |
|  17 | Database không mở public            | Cần xác nhận dashboard   | Tài liệu dự án ghi Supabase Data API đã tắt. Phải kiểm tra lại trên project production; code không thể chứng minh cấu hình dashboard.                                                                                     |
|  18 | DB user chỉ có đúng quyền cần dùng  | Cần cấu hình hạ tầng     | Cần tách/quản lý role kết nối production và kiểm tra quyền trong Supabase/Postgres. Không giải quyết bằng frontend/API code.                                                                                              |
|  19 | Đưa web qua Cloudflare              | Chưa làm                 | Hiện dùng Vercel. Chỉ cấu hình Cloudflare khi đã có domain và quyết định DNS/WAF; tránh thêm proxy khi chưa có kế hoạch cache, webhook và rollback.                                                                       |
|  20 | Backup + theo dõi lỗi               | Một phần                 | Code Sentry và health endpoint đã có; chưa có tài khoản Sentry/uptime alert. Cần xác nhận backup/PITR production và diễn tập khôi phục thay vì chỉ thấy trạng thái “backup enabled”.                                      |

## Thay đổi đã hoàn thành trên nhánh

- Xác minh upload server-side cho mọi media công khai được lưu lâu dài.
- Lưu `publicId` cho avatar và ảnh bìa; migration thêm hai cột nullable.
- Chặn chat tạo booking-link giả và chỉ trả tóm tắt booking cho đúng hai bên.
- Ẩn yêu cầu đang chờ duyệt, bị từ chối hoặc đã đóng khỏi người không có quyền.
- Khai báo thời hạn session 30 ngày.
- Che nội dung lỗi trực tiếp từ cổng thanh toán.

Migration `20260923093000_add_account_media_public_ids` đã áp dụng thành công
trên database development. Hai biến `DATABASE_URL` và `DIRECT_URL` của Vercel
Preview đã được đồng bộ lại với database development; Production chưa được áp
dụng hoặc thay đổi.

## Kết quả kiểm tra

- `pnpm lint`: không có error; còn warning trong file MapLibre vendor.
- `pnpm typecheck`: đạt.
- `pnpm test`: 523/523 test đạt.
- `pnpm build`: đạt, tạo thành công 166 route/page.
- Smoke test production build: `/` và `/api/health` trả HTTP 200; các security
  header xuất hiện trong response.
- Vercel Preview của commit `1a6b72d`: trạng thái `Ready`; alias nhánh tải được
  trang chủ và dữ liệu provider, không có error log runtime. Lỗi build enum
  `COSTUME_SHOP` đã hết sau khi sửa cấu hình database Preview.

## Kiểm thử Preview có đăng nhập

- Đăng nhập thành công bằng tài khoản seed trên database development.
- Tài khoản thường truy cập trực tiếp `/admin` nhận trang 404, không thấy dữ
  liệu hay công cụ quản trị.
- Danh sách yêu cầu hiển thị đúng hai yêu cầu đang mở, đúng tên hiển thị `Gia
Bảo`, giá và phường/xã; yêu cầu của chính tài khoản có nhãn “Yêu cầu của bạn”
  và dẫn về màn quản lý của chủ yêu cầu.
- Hai yêu cầu tự đăng không xuất hiện trong “Yêu cầu phù hợp” và không có form
  gửi đề nghị, nên không thể tự nhận yêu cầu qua giao diện.
- Form tạo yêu cầu thông báo rõ nội dung chỉ được công khai sau khi admin duyệt.
- Danh sách hội thoại và các thẻ booking tải được; ba thẻ có cùng nội dung trong
  dữ liệu test là ba booking khác nhau, không phải một booking bị nhân bản.
- Hồ sơ Costume Shop chỉ cho nhắn tin thuê và không có booking/lịch bận, đúng
  phạm vi sản phẩm hiện tại. Hồ sơ Camera Shop cũng không hiện booking.
- `/shop` đang trả 404 trên Preview vì `MARKETPLACE_ENABLED=false`; cần bật cờ
  Preview trước khi kiểm thử end-to-end đăng sản phẩm, giỏ hàng và đơn hàng.
- Dữ liệu seed `customer@test.com` đã bị lệch so với `prisma/seed.ts`: database
  hiện có thêm role `PHOTOGRAPHER` nhưng chưa có profile/subscription. Vì vậy
  sidebar hiển thị các mục provider và nhãn “Pro — Photographer”. Đây là dữ
  liệu development đã bị thay đổi, không phải bằng chứng khách hàng thuần được
  cấp role provider; vẫn nên làm sạch hoặc seed lại tài khoản test trước vòng QA
  đa vai trò tiếp theo.
- Đã sửa cách hiển thị yêu cầu linh hoạt cũ không có khoảng ngày: dùng câu
  “Linh hoạt — chưa chọn khoảng ngày cụ thể” thay cho `? — ?` ở cả màn chủ yêu
  cầu và màn provider.

## Việc còn lại theo thứ tự ưu tiên

1. Dùng tài khoản thử trên Preview để đi hết các luồng upload, chat, yêu cầu,
   booking và thanh toán giả lập. Preview đang bật Vercel Deployment Protection
   nên các smoke test ẩn danh từ CI chưa truy cập trực tiếp được.
2. Sau khi duyệt Preview, merge và chạy migration production qua workflow có
   approval. Không deploy code dùng cột mới rồi để migration chờ lâu.
3. Chọn shared rate-limit store (Vercel KV/Upstash Redis hoặc giải pháp tương
   đương), sau đó thay bộ đếm trong RAM.
4. Cấu hình Sentry và uptime monitor, đặt người nhận cảnh báo.
5. Xác nhận Supabase backup/PITR, Data API và quyền DB production; thực hiện một
   lần diễn tập restore.
6. Khi có domain chính thức, quyết định Cloudflare/WAF và Allowed origins của
   Cloudinary.
7. Lập task riêng cho CSP nonce nếu muốn bỏ `'unsafe-inline'`; cần đo ảnh hưởng
   tới SSR, cache và dark-mode trước khi triển khai.

## Ghi chú về local AI

Local AI phù hợp với task nhỏ có 1–3 file và acceptance criteria cụ thể. Lượt
Heavy audit sáu file nhắn tin ngày 23/09 đọc file nhưng không đưa ra kết luận sau
10 phút nên đã dừng; Codex tự audit và phát hiện IDOR booking-link. Không nên giao
audit rộng nhiều endpoint cho model local hiện tại. Dùng Daily cho thay đổi hẹp,
sau đó vẫn phải review diff và chạy validation bằng Codex/Claude.
