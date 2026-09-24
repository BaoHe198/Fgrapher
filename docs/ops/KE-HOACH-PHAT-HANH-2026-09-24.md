# Kế hoạch phát hành nhánh `fix/security-foundation`

Ngày chuẩn bị: 24/09/2026  
Commit đã kiểm tra: `44e5efc`  
Preview: `https://fgrapher-git-fix-security-foundation-bao-he.vercel.app`

## Vì sao đợt này cần cửa sổ bảo trì

Đây không phải bản sửa giao diện nhỏ. So với `master`, nhánh có 17 migration.
Migration `20260922110000_drop_legacy_calendar` chuyển lịch làm việc sang cấu
trúc mới rồi xoá hai bảng cũ `availabilities` và `blocked_dates`.

Code cũ cần hai bảng cũ, còn code mới cần các bảng lịch mới. Vì vậy không được
để Vercel deploy code và workflow migration chạy tự do, cách nhau một khoảng
thời gian không kiểm soát. Quay lui riêng code sau khi hai bảng cũ đã bị xoá
cũng không đủ để khôi phục website.

## Trạng thái đã xác minh

- Nhánh không chậm hơn `origin/master` và dự kiến merge không xung đột.
- `pnpm typecheck`: đạt.
- `pnpm test`: 526/526 test đạt, 141 suite.
- `pnpm lint`: không có error; warning còn lại thuộc vendor MapLibre và các
  cảnh báo React Compiler đã biết.
- Vercel Preview deployment `dpl_66s1FwLmbLyEJH5atkLs76FEZAEH`: `Ready`.
- Đã smoke test Customer, Photographer, Camera Shop, Costume Shop và Admin trên
  Preview; chưa tạo bài đăng, tin nhắn, đơn hàng hoặc giao dịch thử.
- Production `/api/health` trả HTTP 200 ngày 24/09/2026.
- Vercel Production đang có `DATABASE_URL`, `DIRECT_URL` và
  `NEXT_PUBLIC_SENTRY_DSN`.

## Ba chốt bắt buộc trước khi bắt đầu

- [ ] Xác nhận Supabase production có backup/PITR dùng được và ghi lại thời điểm
      khôi phục gần nhất.
- [ ] Xác nhận GitHub Environment `production` có required reviewer và hai
      secret `PRODUCTION_DATABASE_URL`, `PRODUCTION_DIRECT_URL` còn hợp lệ.
- [ ] Chọn một khoảng ít người dùng và thông báo cửa sổ bảo trì ngắn. Hiện dự án
      chưa có trang bảo trì tự động.

File `.env.production` trên máy hiện xác thực Supabase thất bại. Không dùng file
này để migration. Việc production vẫn trả health 200 cho thấy credential Vercel
đang hoạt động; credential GitHub Actions là bộ riêng và vẫn phải kiểm tra.

## Trình tự phát hành

1. Mở Vercel Logs và Supabase dashboard để theo dõi trong suốt đợt phát hành.
2. Ghi lại deployment production đang chạy để có mốc đối chiếu.
3. Bắt đầu cửa sổ bảo trì; tránh để người dùng cập nhật lịch trong lúc chuyển dữ
   liệu.
4. Merge nhánh vào `master` trong thời gian có người trực.
5. Vào GitHub Actions, mở workflow **Deploy production** và duyệt lần 1
   (cập nhật database).
6. Chờ migration và bước seed địa giới đều thành công. Nếu migration lỗi, dừng
   release; không bấm chạy lại theo phỏng đoán.
7. Duyệt lần 2 (deploy code), chờ Vercel Production chuyển sang `Ready`.
8. Smoke test theo danh sách bên dưới rồi kết thúc cửa sổ bảo trì.

Code chỉ được deploy sau khi migration thành công (xem `VAN-HANH-PRODUCTION.md`
§7), nên không còn khoảng code mới chạy trên database cũ.

## Smoke test production sau phát hành

- [ ] `/api/health` trả HTTP 200.
- [ ] Trang chủ, Ffinding, Fmap, Fmarket và Fcommunity mở được.
- [ ] Customer đăng nhập, xem yêu cầu của mình và danh sách yêu cầu công khai.
- [ ] Photographer mở Portfolio, lịch làm việc và yêu cầu phù hợp.
- [ ] Costume Shop thấy “Trang phục của tôi”, không thấy Portfolio/lịch provider.
- [ ] Camera Shop mở danh sách sản phẩm, không thấy Portfolio/lịch provider.
- [ ] Admin mở trang duyệt yêu cầu và thấy đúng số lượng hàng chờ.
- [ ] Kiểm tra Vercel Logs không có lỗi Prisma kiểu “table/column does not exist”.
- [ ] Theo dõi ít nhất 15 phút trước khi kết thúc release.

## Khi có lỗi

- Nếu migration chưa chạy mà code mới đã lỗi, ưu tiên hoàn tất migration ngay
  nếu ba chốt bắt buộc ở trên đều đã đạt.
- Nếu migration lỗi giữa chừng, dừng lại và kiểm tra `_prisma_migrations`; làm
  theo `docs/MIGRATIONS.md`, không tự sửa bảng bằng tay.
- Nếu migration đã xoá bảng lịch cũ, không chỉ promote deployment cũ rồi coi là
  rollback hoàn tất. Phải đánh giá khôi phục database/PITR vì code cũ còn cần
  hai bảng đó.
- Nếu code mới lỗi nhưng schema mới đã chạy thành công, sửa tiến trên nhánh mới
  thường an toàn hơn quay lại code cũ.

## Việc hạ tầng không nằm trong release này

Các việc sau vẫn cần hoàn thành nhưng không nên trộn vào cửa sổ migration lớn:
shared rate-limit store, uptime monitor, kiểm tra người nhận cảnh báo Sentry,
quyền tối thiểu của DB user, Cloudflare/WAF và CSP nonce.

**Bắt buộc trước khi có người dùng thật:** đổi mật khẩu database production
(Supabase → Project Settings → Database → Reset database password). Ngày
24/09/2026 mật khẩu hiện tại đã xuất hiện trong phiên chat với AI và lịch sử
Terminal khi chạy migration bằng tay. Chủ dự án chấp nhận tạm hoãn vì
production lúc đó chỉ có dữ liệu thử. Đổi xong phải cập nhật cùng lúc: Vercel
(`DATABASE_URL`, `DIRECT_URL` môi trường Production) và GitHub Secrets
(`PRODUCTION_DATABASE_URL`, `PRODUCTION_DIRECT_URL`).
