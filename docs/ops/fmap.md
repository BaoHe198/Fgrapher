# Fmap — tìm nhà cung cấp trên bản đồ

## Hiểu nhanh

Fmap trả lời câu hỏi: ai cung cấp dịch vụ tôi cần, gần khu vực này, rảnh vào giờ tôi cần. Không phải bản đồ theo dõi vị trí thời gian thực; vị trí provider là địa chỉ dịch vụ cố định trong hồ sơ.

## Luồng hoạt động

1. Khách chọn khu vực: nút "Vị trí của tôi" (dùng GPS, không bắt buộc), chọn tỉnh/thành và (tuỳ chọn) phường/xã, hoặc kéo bản đồ rồi bấm "Tìm trong khu vực này". Chọn tỉnh/phường thì bản đồ tự thu phóng tới nơi có provider và tìm luôn; chọn phường thì kết quả chỉ gồm provider ở phường đó. Danh sách phường/xã chỉ hiện những phường đang có provider của vai trò đã chọn, kèm số lượng (`GET /api/fmap/ward-counts`); đổi vai trò mà phường đang chọn không còn ai thì bộ lọc phường tự bỏ.
2. Chọn ngày, giờ bắt đầu/kết thúc (danh sách 24 giờ, bước 30 phút), vai trò, thể loại. Đổi bất kỳ mục nào thì bản đồ tự tìm lại sau 0,4 giây. Khung giờ phải dài 30 phút – 12 tiếng; sai thì báo ngay dưới bộ lọc thay vì gửi yêu cầu. Trên điện thoại, bộ lọc thu gọn thành một dòng tóm tắt.
3. API `GET /api/fmap/providers` lọc theo khung bản đồ, vai trò, thể loại, rồi loại provider không rảnh: lịch tuần, ngày bận, booking PENDING/CONFIRMED, và quy định đặt trước tối thiểu 24 giờ.
4. Marker hiện avatar, icon vai trò, giá khởi điểm; nhiều provider gần nhau gom thành cụm có số. Bấm cụm để phóng to; nếu các provider ở gần như cùng một chỗ (không tách được dù phóng tối đa) thì hiện danh sách để chọn.
5. Bấm marker mở thẻ xem nhanh (`GET /api/fmap/providers/[profileId]`), bản đồ vẫn nhìn thấy phía sau.
6. "Xem hồ sơ" hoặc "Đặt lịch". Trang đặt lịch nhận sẵn ngày, giờ, khung giờ mong muốn và thể loại; khách chưa đăng nhập vẫn giữ các thông tin này sau khi đăng nhập.
7. Không có kết quả: hiện gợi ý "Đổi thời gian", "Mở rộng khu vực", "Đổi dịch vụ".

## Lấy tọa độ (geocoding)

**Nhà cung cấp dịch vụ địa chỉ:** mặc định dùng **Goong** (goong.io — dịch vụ bản đồ Việt Nam, gợi ý tới số nhà/hẻm) khi có `GOONG_API_KEY`; không có thì quay về MapTiler (chỉ tới cấp tên đường ở Việt Nam). Ép chọn bằng `GEOCODING_PROVIDER=goong|maptiler`. Nền bản đồ luôn do MapTiler/OpenFreeMap vẽ, không liên quan lựa chọn này. Code: `src/services/geocoding.ts` (điều phối), `src/services/goong.ts`, `src/services/geocoding-types.ts`.

**Gợi ý địa chỉ:** trong Cài đặt hồ sơ, ô "Địa chỉ chi tiết" hiện danh sách gợi ý khi gõ từ 3 ký tự (`GET /api/geocoding/suggest`, chỉ người đã đăng nhập, tối đa 30 lần/phút mỗi người; key MapTiler nằm ở server). Chọn một gợi ý thì tọa độ của đúng địa chỉ đó được lưu thẳng khi bấm Lưu (với Goong, danh sách gợi ý chưa kèm tọa độ nên form gọi thêm `GET /api/geocoding/place?id=` để lấy) — marker khớp địa chỉ chi tiết (vẫn làm mờ nếu provider bật "Làm mờ vị trí"). Gõ tay không chọn gợi ý thì hệ thống tự tìm tọa độ lúc lưu như trước. Chưa có `MAPTILER_API_KEY` thì ô vẫn gõ tay được và báo "Gợi ý địa chỉ chưa được bật"; hồ sơ chưa có vị trí sẽ thấy cảnh báo "chưa hiện trên Fmap".

Geocoding = đổi địa chỉ dạng chữ thành vĩ độ/kinh độ. Lưu hồ sơ không làm mất tọa độ đang có khi dịch vụ geocoding chưa cấu hình hoặc lỗi tạm thời; chỉ khi địa chỉ thật sự đổi thì tọa độ cũ mới bị bỏ (trạng thái PENDING nếu chưa có key, FAILED nếu lỗi). Chỉ chạy khi provider lưu hồ sơ và địa chỉ thật sự đổi (so bằng mã băm `geocodeAddressHash`), không chạy mỗi lần mở bản đồ. Dùng MapTiler (`MAPTILER_API_KEY`, chỉ ở server). Thiếu key thì bỏ qua êm: hồ sơ vẫn lưu được nhưng chưa hiện trên Fmap (`geocodingStatus` = PENDING hoặc FAILED). Hồ sơ đã có từ trước: chạy `pnpm db:backfill:coordinates --dry-run` để xem trước, bỏ `--dry-run` để chạy thật, thêm `--retry-failed` để thử lại hồ sơ lỗi, `--limit=N` để giới hạn số hồ sơ. Phải export `MAPTILER_API_KEY` trong terminal trước khi chạy. Chạy trên dev trước, production sau (theo `docs/MIGRATIONS.md`). Script không in địa chỉ ra màn hình.

## Quyền riêng tư

- Tọa độ chính xác chỉ nằm ở server.
- Mặc định mọi provider bật "Làm mờ vị trí trên Fmap": marker lệch cố định 300–650 m, tính bằng HMAC với `NEXTAUTH_SECRET` nên không đảo ngược được. Provider tắt được trong Cài đặt hồ sơ nếu là studio/cửa hàng mở cửa công khai.
- Việc "provider có nằm trong khung bản đồ không" được quyết định bằng **vị trí đã làm mờ**, không phải vị trí thật. (Trước đây lọc bằng vị trí thật nên có thể thu nhỏ khung dần để dò ra đúng nhà — đã sửa.) Máy chủ lấy rộng hơn khung khoảng 800 m rồi lọc lại theo vị trí công khai.
- Khi khách chọn tỉnh/phường, khung bản đồ được nới rộng khoảng 5 km và làm tròn, để nơi chỉ có 1 provider cũng không lộ địa chỉ.
- API không bao giờ trả địa chỉ chi tiết, số điện thoại hay Zalo.
- Tọa độ GPS của khách không được gửi đi; máy chủ chỉ nhận khung bản đồ đang xem (một vùng rộng vài km).

## Bản đồ nền

MapLibre GL (thư viện bản đồ mã nguồn mở). `NEXT_PUBLIC_MAP_STYLE_URL` để dùng nhà cung cấp bản đồ trả phí (ví dụ MapTiler); để trống thì dùng OpenFreeMap (miễn phí, không cần key). Không dùng `tile.openstreetmap.org` vì chính sách của họ không cho ứng dụng dùng và một số nhà mạng Việt Nam không phân giải được tên miền đó. File worker của MapLibre được copy vào `public/vendor/maplibre-gl/` bởi `scripts/copy-maplibre-worker.mjs` mỗi lần `pnpm install` — nếu thiếu bước này bản đồ sẽ trắng, vì Turbopack làm hỏng đường dẫn MapLibre tự dò. CSP trong `next.config.ts` cho phép `api.maptiler.com`, `tiles.openfreemap.org` và `worker-src blob:`; Permissions-Policy cho phép `geolocation=(self)`.

## Hiệu năng

- Chỉ truy vấn trong khung bản đồ (tối đa 6° mỗi chiều); tối đa 600 ứng viên và 250 marker mỗi lần; kiểm tra lịch rảnh theo lô, chỉ 3 truy vấn cho tất cả ứng viên; không tự tìm lại khi kéo bản đồ (khách bấm "Tìm trong khu vực này"); thẻ xem nhanh chỉ tải khi bấm marker; giới hạn 60 lượt tìm/phút mỗi IP.
- Chưa dùng PostGIS; khi dữ liệu lớn có thể chuyển sang `geography(Point)` kèm chỉ mục GiST.

## Thay đổi database

Migration `prisma/migrations/20260919000000_add_geocoding_fields`: thêm vào bảng `profiles` các cột `latitude`, `longitude`, `geocodedAt`, `geocodeAddressHash`, `geocodingStatus` (enum `GeocodingStatus`: PENDING/READY/FAILED) và chỉ mục `(latitude, longitude)`; thêm chỉ mục `bookings(providerId, date, status)`; đặt `hideExactLocation = true` cho mọi hồ sơ hiện có và làm giá trị mặc định.

### Cách hoàn tác (rollback)

Cảnh báo: giá trị cũ của `hideExactLocation` không thể khôi phục được (migration đã ghi đè chúng).

```sql
DROP INDEX IF EXISTS "bookings_providerId_date_status_idx";
DROP INDEX IF EXISTS "profiles_latitude_longitude_idx";
ALTER TABLE "profiles" ALTER COLUMN "hideExactLocation" SET DEFAULT false;
ALTER TABLE "profiles"
  DROP COLUMN "geocodingStatus",
  DROP COLUMN "geocodeAddressHash",
  DROP COLUMN "geocodedAt",
  DROP COLUMN "longitude",
  DROP COLUMN "latitude";
DROP TYPE "GeocodingStatus";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20260919000000_add_geocoding_fields';
```

## File chính

| File                                              | Vai trò                                                           |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| `src/app/(public)/fmap/fmap-client.tsx`           | Component client chứa logic tìm kiếm và điều khiển giao diện Fmap |
| `src/components/fmap/fmap-map.tsx`                | Trình bày bản đồ với marker, cụm điểm, hệ thống điều hướng        |
| `src/components/fmap/fmap-filter-bar.tsx`         | Bộ lọc tìm kiếm theo thời gian, vị trí, vai trò và thể loại       |
| `src/components/fmap/fmap-provider-preview.tsx`   | Thẻ xem nhanh thông tin provider khi click marker trên bản đồ     |
| `src/services/fmap.ts`                            | Logic kiểm tra khả dụng và tạo marker trên bản đồ                 |
| `src/services/geocoding.ts`                       | Dịch địa chỉ thành tọa độ GPS                                     |
| `src/app/api/fmap/providers/route.ts`             | API endpoint để tìm provider theo vị trí bản đồ                   |
| `src/app/api/fmap/providers/[profileId]/route.ts` | API endpoint để lấy thông tin chi tiết của provider               |
| `src/app/api/fmap/province-bounds/route.ts`       | API endpoint trả về vị trí của một tỉnh trên bản đồ               |
| `src/lib/validations/fmap.ts`                     | Validator cho input yêu cầu tìm kiếm                              |
| `scripts/backfill-profile-coordinates.ts`         | Script hoàn tất tọa độ cho các hồ sơ đã có                        |
| `scripts/copy-maplibre-worker.mjs`                | Script copy file worker cho bản đồ MapLibre vào thư mục public    |
