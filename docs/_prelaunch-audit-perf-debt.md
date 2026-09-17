# Báo cáo lịch sử: hiệu năng và nợ kỹ thuật trước khi ra mắt

> Báo cáo phản ánh code tại thời điểm audit. Một số mục đã được sửa. Không dùng mức
> ưu tiên bên dưới như trạng thái issue hiện tại nếu chưa kiểm tra lại.

## 1. Cách đọc

- **N+1 query:** lấy danh sách bằng một query rồi chạy thêm một query cho từng dòng.
- **Index:** cấu trúc giúp database lọc/sort nhanh hơn, đổi lại tốn dung lượng và chi
  phí ghi.
- **Technical debt:** cách làm tạm khiến thay đổi sau khó, chậm hoặc dễ lỗi hơn.

## 2. N+1 query được phát hiện

### Danh sách hội thoại — mức cao

Phiên bản cũ đọc hội thoại rồi chạy thêm query để lấy unread/participant cho từng
hội thoại. Khi user có nhiều cuộc trò chuyện, số query tăng tuyến tính.

Cách sửa mong đợi:

- include/select đủ dữ liệu trong query chính;
- group/count theo lô;
- tránh gọi service con bên trong `map` nếu service đó truy cập database;
- đo số query với 1, 10 và 100 hội thoại.

### Thống kê consent — mức thấp

Một số nhóm thống kê được đếm bằng nhiều query tuần tự. Có thể gom bằng `groupBy`
hoặc chạy query độc lập bằng `Promise.all`. Chỉ tối ưu khi dữ liệu/admin traffic đủ
lớn để có ý nghĩa.

### Xoá KYC hết hạn — chấp nhận được nhưng cần batch

Xoá asset Cloudinary thường phải gọi từng file. Đây không phải N+1 database thuần,
nhưng batch cần giới hạn để cron không chạy quá thời gian và có thể tiếp tục ở lần
sau khi một file lỗi.

## 3. Index cần xem xét

Audit cũ nêu các cột như:

- trạng thái khoá/xác minh/xoá mềm của User;
- `Message.senderId`;
- `Subscription.stripeCustomerId` khi Stripe hoạt động.

Không thêm index chỉ vì một cột xuất hiện trong WHERE. Trước khi thêm:

1. lấy query thật và `EXPLAIN ANALYZE`;
2. xem độ chọn lọc và thứ tự cột;
3. kiểm tra index tương tự đã tồn tại;
4. tính chi phí ghi và dung lượng;
5. với bảng production lớn, lập kế hoạch tạo không khoá lâu.

Các bảng Booking, Notification, Conversation, Profile và media đã có nhiều index
phù hợp ở thời điểm audit.

## 4. Ảnh và media

Các điểm cần kiểm tra:

- dùng `next/image` hoặc kích thước rõ để tránh layout shift;
- URL Cloudinary có thumbnail/quality/format phù hợp;
- không mount cả carousel khi chỉ hiển thị một ảnh;
- ảnh dưới màn hình dùng lazy loading;
- hero/LCP chỉ ưu tiên đúng một ảnh cần thiết;
- video không preload toàn bộ;
- xoá database phải có lifecycle xoá asset thật.

Tối ưu ảnh cần đo LCP, payload và số request, không chỉ thay thẻ HTML.

## 5. Cách dùng `any`

`any` làm mất bảo vệ của TypeScript. Audit cũ phân biệt:

- `any` bắt buộc do thư viện/JSON bên ngoài: bọc tại biên và validate;
- `any` trong business logic: nên thay bằng type/unknown + narrowing;
- cast để né lỗi compiler: cần xem lại thiết kế dữ liệu thay vì giữ lâu dài.

Mục tiêu không phải xoá chữ `any` bằng mọi giá mà giữ dữ liệu chưa tin cậy ở trạng
thái `unknown` cho tới khi Zod/type guard xác nhận.

## 6. Quy tắc lint bị tắt

Khi tắt lint:

1. ghi lý do tại đúng chỗ;
2. giới hạn một dòng/file nhỏ thay vì tắt toàn dự án;
3. tạo issue nếu chỉ là giải pháp tạm;
4. không tắt quy tắc auth, hook hoặc promise chỉ để CI xanh.

Đặc biệt, dependency của React hook sai có thể tạo state cũ, vòng lặp request hoặc
cleanup không chạy.

## 7. TODO còn sót

TODO có ba loại:

- việc bắt buộc trước launch;
- cải tiến sau MVP;
- ghi chú đã hết hạn.

TODO quan trọng phải thành issue có owner/ưu tiên. Ghi chú không còn đúng phải xoá
hoặc cập nhật; để trong code khiến người mới tin sai.

## 8. Business logic trong component

Audit cũ tìm thấy quy tắc giá/trạng thái nằm trong component. Business logic ở UI
dễ bị lặp và có thể bị bỏ qua khi gọi API trực tiếp.

Nên chuyển:

- validation và policy dùng chung vào `lib`;
- thao tác nghiệp vụ/transaction vào `services`;
- component chỉ giữ state hiển thị, format và event gọi action/API.

Ví dụ giá thuê phải có một hàm nguồn chung; server tính lại, client chỉ hiển thị ước
tính.

## 9. Ưu tiên xử lý

1. Query chạy ở trang đông người và tăng theo số bản ghi.
2. Polling/request thừa xảy ra liên tục cho mọi user.
3. Thiếu pagination hoặc trả dữ liệu nhạy cảm/thừa.
4. Business logic có thể bị bypass ở API.
5. Index dựa trên query production thật.
6. Cleanup type/lint/TODO ít ảnh hưởng runtime.

## 10. Cách xác minh sau khi sửa

- So số query và thời gian trước/sau.
- Dùng dataset đủ lớn; seed vài chục dòng có thể che vấn đề.
- Chạy test hành vi để chắc tối ưu không đổi kết quả.
- Kiểm tra CPU/memory/kết nối database và chi phí dịch vụ ngoài.
- Xem network khi tab visible/hidden.
- Không tuyên bố nhanh hơn nếu chưa có số đo.

Xem `docs/ops/CAM-NANG-KIEN-THUC-IT-FGRAPHER.md` phần cache/hiệu năng để học các
khái niệm nền.
