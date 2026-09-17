# Kiểm duyệt nội dung: máy lọc trước, con người quyết định

## Hiểu nhanh

Mọi ảnh portfolio mới đều vào hàng chờ `/admin/moderation` với trạng thái
`PENDING` (đang chờ). Ảnh chỉ được công khai sau khi admin duyệt. Điều này được
kiểm tra ở cả lúc tìm kiếm (`services/search.ts`) và lúc công khai hồ sơ
(`setProfilePublished()`).

Bộ quét tự động chỉ giúp **xếp ảnh đáng ngờ lên đầu hàng chờ**. Nó không có quyền
duyệt, từ chối hay phạt tài khoản.

```text
Người dùng tải ảnh
  → tạo ProfileMedia ở trạng thái PENDING
  → runModeration() chạy nền
  → gửi bản ảnh 512px cho OpenAI omni-moderation-latest
     → điểm sexual hoặc violence/graphic từ 0,9 trở lên
        → ghi lý do và thời điểm gắn cờ
        → ảnh vẫn PENDING, nhưng được đưa lên đầu hàng chờ của admin
     → điểm thấp hơn hoặc quét lỗi
        → không ghi cờ; ảnh vẫn chờ admin như bình thường
```

Ba nguyên tắc không được thay đổi:

1. Máy không bao giờ tự duyệt ảnh.
2. Máy không tự ẩn hoặc từ chối ảnh.
3. Máy không tự phạt người dùng.

Nếu máy đoán sai, hậu quả lớn nhất chỉ là admin xem một ảnh bình thường sớm hơn.

## Ai có quyền phạt tài khoản?

Chỉ admin có thể ghi điểm vi phạm tại `/admin/users/[id]` bằng thao tác “Ghi nhận
vi phạm”, gọi `addViolationPoint()` trong `services/admin.ts`.

Các việc sau **không phải hình phạt**:

- máy gắn cờ ảnh, vì việc này chỉ đổi thứ tự hàng chờ;
- admin từ chối ảnh trong `moderateMedia()`, vì thao tác này chỉ ẩn ảnh và gửi lý
  do cho provider.

Quy trình mong muốn là: máy gắn cờ → admin xem → admin từ chối nếu vi phạm →
admin liên hệ, cảnh báo → khi thật sự cần mới ghi điểm vi phạm. Một ảnh bị từ chối
có thể chỉ do người dùng hiểu sai quy định, nên không được đồng nhất với hành vi
xấu.

Khi ghi điểm, admin bắt buộc nhập lý do. Lý do được lưu trong `AuditLog` để sau
này giải thích được khi provider khiếu nại. Điểm thứ ba tự đình chỉ tài khoản,
đúng với nội dung trang `/guidelines`. Giao diện luôn cảnh báo rõ trước khi admin
tạo điểm thứ ba; admin cũng có thể xoá điểm hoặc bỏ đình chỉ.

## Dữ liệu nào được gửi ra ngoài?

OpenAI chỉ nhận **bản thu nhỏ 512px do Cloudinary tạo lại**, không nhận file gốc.
URL được tạo bởi `buildMediaVariants(url).moderation` trong
`lib/media-variants.ts`.

Điều này giảm dữ liệu gửi đi:

- Cloudinary mã hoá lại ảnh nên metadata EXIF không đi kèm: không có GPS, số
  serial máy ảnh hoặc thời điểm chụp.
- 512px đủ để phân loại nội dung, nhưng khó dùng để nhận diện một người.

Tuy vậy, đây vẫn là việc chuyển dữ liệu cho bên thứ ba. Thu nhỏ ảnh không làm
cho nghĩa vụ về quyền riêng tư biến mất.

## Dữ liệu đang nằm ở đâu?

| Thành phần              | Khu vực đã xác nhận                                           |
| ----------------------- | ------------------------------------------------------------- |
| Máy chủ ứng dụng Vercel | Singapore, cấu hình `sin1`                                    |
| Database Supabase       | Singapore, `ap-southeast-1`                                   |
| Kho ảnh Cloudinary      | Chưa xác nhận được từ code; phải xem trong Cloudinary Console |
| Dịch vụ quét OpenAI     | Hoa Kỳ                                                        |

Ứng dụng và database đã đặt gần Việt Nam. Khu vực Cloudinary phụ thuộc tài khoản
và cần kiểm tra thủ công. Nếu ảnh gốc đang lưu ở Hoa Kỳ thì đó là luồng dữ liệu
lớn và lâu dài hơn nhiều so với bản 512px dùng để quét.

Code không thể làm OpenAI chạy tại Việt Nam. Nếu dữ liệu bắt buộc ở trong nước,
có ba lựa chọn thật sự:

1. Dùng nhà cung cấp Việt Nam như VNPT hoặc FPT.AI. Interface `ContentScanner`
   cho phép thêm nhà cung cấp mới mà không sửa các nơi gọi.
2. Tự vận hành model phân loại trên hạ tầng tại Việt Nam. Cách này bỏ bên thứ ba
   nhưng tạo thêm chi phí và trách nhiệm vận hành máy chủ.
3. Tắt quét tự động. Hàng chờ admin vẫn hoạt động như trước.

## Việc đồng ý xử lý dữ liệu trước khi bật

`ConsentPurpose` hiện chưa có mục riêng cho việc gửi ảnh tới dịch vụ phân loại
nội dung của bên thứ ba. Không nên gộp việc này vào mục `SERVICE` vì người dùng
cần được biết rõ ảnh được gửi cho ai và để làm gì.

Trước khi bật cho người dùng thật, cần:

- thêm một mục đích đồng ý riêng trong `ConsentPurpose`;
- cập nhật chính sách quyền riêng tư, nêu rõ OpenAI là bên xử lý dữ liệu;
- để chủ dự án và luật sư xác nhận nội dung.

Vì vậy `CONTENT_MODERATION_ENABLED` mặc định là `false`. Đây là quyết định tuân
thủ dữ liệu, không phải vì code chưa hoàn thành.

## Cách bật

```bash
OPENAI_API_KEY="sk-..."
CONTENT_MODERATION_ENABLED="true"
```

Cần đủ cả hai biến. Nếu bật flag nhưng thiếu API key, hệ thống dùng
`MockScanner`, tức là không tự gắn cờ và vẫn để admin duyệt thủ công.

Endpoint Moderation của OpenAI hiện không tính phí và không trừ hạn mức API,
nhưng chính sách nhà cung cấp có thể thay đổi; cần kiểm tra lại trước khi bật.

## Những gì bộ quét không phát hiện được

Điều quan trọng nhất: `sexual/minors` là nhóm chỉ hỗ trợ văn bản trong API
Moderation, không áp dụng cho ảnh. Vì vậy hệ thống **không thể tự phát hiện người
chưa thành niên trong ảnh**. Việc này hoàn toàn phụ thuộc vào admin và báo cáo từ
người dùng.

Các nhóm OpenAI có thể đánh giá trên ảnh gồm `sexual`, `violence`,
`violence/graphic`, `self-harm`, `self-harm/intent` và
`self-harm/instructions`. Tài liệu nguồn:
<https://developers.openai.com/api/docs/guides/moderation>.

Hệ thống cũng không tự gắn cờ:

- video, vì hiện không trích frame để quét;
- ảnh có điểm dưới 0,9;
- nhóm self-harm, vì ảnh sẹo, tài liệu y khoa hoặc ảnh phóng sự dễ bị báo nhầm.

## Vì sao ngưỡng là 0,9?

API có cờ `flagged` riêng, nhưng cờ này nhạy và có thể bắt nhiều trường hợp ranh
giới. Nếu quá nhiều ảnh đều bị đánh dấu “khẩn cấp”, admin sẽ mất niềm tin vào
hàng chờ. Ngưỡng 0,9 giúp nhãn ưu tiên có ý nghĩa hơn.

Chỉ `sexual` và `violence/graphic` được dùng để gắn cờ. Hằng số tương ứng là
`AUTO_FLAG_THRESHOLD` và `AUTO_FLAG_CATEGORIES` trong
`services/moderation.ts`.

## Khi quét bị lỗi

Mọi lỗi đều dẫn đến cùng kết quả: không ghi cờ, ảnh vẫn nằm trong hàng chờ theo
thứ tự thời gian.

| Tình huống                               | Kết quả      |
| ---------------------------------------- | ------------ |
| Thiếu API key hoặc feature flag đang tắt | Không gắn cờ |
| Lỗi mạng, HTTP lỗi hoặc JSON sai         | Không gắn cờ |
| Quá 10 giây                              | Không gắn cờ |
| URL không phải `http(s)`                 | Không gắn cờ |
| File video                               | Không gắn cờ |

Upload portfolio gọi `runModeration()` theo kiểu chạy nền nên lỗi quét không làm
upload thất bại.

Avatar và ảnh bìa là ngoại lệ: endpoint `/api/users/me` chờ kết quả quét ngay và
từ chối với HTTP 422 nếu ảnh bị gắn cờ. Hai loại ảnh này xuất hiện ngay, không đi
qua hàng chờ admin; vì vậy cần kiểm tra trước khi cho hiển thị. Việc từ chối upload
không tạo điểm phạt, người dùng chỉ cần chọn ảnh khác.

## File và màn hình liên quan

| Thành phần         | Vị trí                                      |
| ------------------ | ------------------------------------------- |
| Client gọi OpenAI  | `src/lib/openai-moderation.ts`              |
| Tạo bản ảnh nhỏ    | `src/lib/media-variants.ts`                 |
| Policy và scanner  | `src/services/moderation.ts`                |
| Điểm vi phạm       | `src/services/admin.ts`                     |
| Test               | `src/services/__tests__/moderation.test.ts` |
| Hàng chờ admin     | `src/app/(admin)/admin/moderation/`         |
| Giao diện ghi điểm | `src/app/(admin)/admin/users/[id]/`         |
| Upload portfolio   | `src/app/api/portfolio/route.ts`            |
| Avatar và ảnh bìa  | `src/app/api/users/me/route.ts`             |

Các sự kiện audit được ghi như sau:

| Sự kiện                        | `AuditLog.action`                  | Hàm ghi                  |
| ------------------------------ | ---------------------------------- | ------------------------ |
| Máy gắn cờ ảnh                 | `MEDIA_AUTO_FLAGGED`               | `runModeration()`        |
| Admin duyệt hoặc từ chối       | `MEDIA_APPROVED`, `MEDIA_REJECTED` | `moderateMedia()`        |
| Admin ghi điểm                 | `USER_VIOLATION_POINT_ADDED`       | `addViolationPoint()`    |
| Điểm thứ ba đình chỉ tài khoản | `USER_AUTO_SUSPENDED`              | `addViolationPoint()`    |
| Admin xoá điểm                 | `USER_VIOLATION_POINTS_CLEARED`    | `clearViolationPoints()` |

## Tuyệt đối không gửi ảnh KYC

Ảnh giấy tờ và ảnh selfie xác minh danh tính nằm trong thư mục Cloudinary riêng,
không công khai, chỉ truy cập qua URL ký có thời hạn ngắn. Không được đưa các URL
KYC vào bộ quét này. Lớp bảo vệ hiện tại là không có nơi nào gọi scanner với URL
KYC; phải giữ nguyên ranh giới đó.

## Từ ngữ cần nhớ

- **Moderation:** kiểm duyệt nội dung.
- **Classifier/scanner:** chương trình chấm điểm, phân loại nội dung.
- **Derivative:** bản ảnh được tạo lại với kích thước hoặc chất lượng khác.
- **EXIF:** metadata có thể chứa thiết bị, thời gian và GPS của ảnh.
- **KYC:** xác minh danh tính bằng giấy tờ và ảnh khuôn mặt.
- **Audit log:** nhật ký ghi ai đã làm gì và khi nào.
