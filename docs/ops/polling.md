# Cơ chế cập nhật dữ liệu định kỳ (polling)

## Hiểu nhanh

Fgrapher chưa dùng kết nối thời gian thực như Pusher, WebSocket hay Socket.io.
Thay vào đó, khi người dùng đang mở trang, trình duyệt sẽ hỏi máy chủ theo chu kỳ:
“Có tin nhắn hoặc thông báo mới không?”. Cách hỏi lặp lại này gọi là **polling**.

Polling dễ vận hành, nhưng nếu làm không cẩn thận sẽ tạo rất nhiều request và truy
vấn database không cần thiết. Tài liệu này mô tả quy tắc chung của dự án để tránh
lãng phí đó.

## Quy tắc chung

Mọi phần cần cập nhật theo chu kỳ phải dùng hook `usePolling` tại
`src/hooks/use-polling.ts`. Không component nào được tự tạo `setInterval`. Test tại
`src/hooks/__tests__/polling-policy.test.ts` sẽ phát hiện nếu quy tắc này bị phá.

Phần quyết định nằm trong `src/hooks/polling-policy.ts`. Đây là các hàm thuần,
không phụ thuộc trình duyệt, nên dễ kiểm tra bằng unit test. Hook `usePolling` chỉ
chịu trách nhiệm nối các quy tắc đó với giao diện.

| Quy tắc                                         | Hàm liên quan           | Lý do dễ hiểu                                                                           |
| ----------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------- |
| Dừng khi tab bị ẩn                              | `canPoll`               | Không ai đang nhìn, tiếp tục hỏi chỉ tốn tài nguyên.                                    |
| Không chạy hai request cùng lúc                 | `canPoll` và `inFlight` | Request cũ phải xong rồi mới lên lịch request mới, tránh kết quả cũ ghi đè kết quả mới. |
| Vừa quay lại tab thì cập nhật ngay              | `shouldCatchUp`         | Người dùng không phải chờ hết chu kỳ mới thấy dữ liệu mới.                              |
| Bỏ kết quả đã lỗi thời                          | `isFreshResponse`       | Một lần tải thủ công có thể “đua” với lần tải tự động; chỉ kết quả mới nhất được dùng.  |
| Chỉ đánh dấu đã đọc khi thật sự có tin chưa đọc | `shouldMarkRead`        | Mỗi lần đánh dấu cần hai thao tác ghi database.                                         |

Các tuỳ chọn thường gặp:

- `enabled`: bật hoặc tạm dừng polling, ví dụ dừng khi cửa sổ chat đóng.
- `resetKey`: đổi đối tượng đang theo dõi và tải lại ngay, ví dụ chuyển hội thoại.
- `skipInitialRun`: bỏ lần gọi đầu tiên khi trang đã nhận sẵn dữ liệu từ server.

Khoảng cách thực tế giữa hai lần gọi bằng `interval + thời gian phản hồi`. Ví dụ,
polling 2 giây với request mất 0,2 giây sẽ chạy khoảng 2,2 giây/lần. Nếu server
chậm 2 giây thì thành khoảng 4 giây/lần. Việc này có chủ đích: hệ thống ưu tiên
không chồng request hơn là cố bám đúng đồng hồ.

## Các lỗi đã từng tồn tại

- Popup tin nhắn từng render đồng thời hai cây giao diện desktop và mobile, rồi
  chỉ ẩn một cây bằng CSS. CSS chỉ làm phần tử không nhìn thấy; component vẫn tồn
  tại và vẫn polling. Vì vậy một hội thoại tạo hai `ChatPanel` và gấp đôi request.
- `PATCH /read` từng chạy sau mọi lần tải tin nhắn, khoảng hai giây/lần, kể cả khi
  không có gì mới. Mỗi lần gọi thực hiện hai thao tác ghi database.
- Tab chạy nền vẫn tiếp tục polling.
- Chuông thông báo từng tải cả danh sách chỉ để hiện một con số. Endpoint đầy đủ
  cần một `findMany` và hai `count`; endpoint `?countOnly=true` hiện chỉ cần một
  `count` khi menu đang đóng.

## Kết quả đo

Phép đo dùng Chromium qua Playwright, chạy trên server phát triển, đăng nhập bằng
tài khoản mẫu và mở một hội thoại trong 20 giây.

| Tình huống trong 20 giây            |                   Trước khi tối ưu | Sau khi tối ưu |
| ----------------------------------- | ---------------------------------: | -------------: |
| Tab đang mở, hội thoại đang xem     |                         22 request |      8 request |
| Request lấy tin nhắn                |                                 10 |              5 |
| Request đánh dấu đã đọc             |                                 10 |              1 |
| Lấy danh sách hội thoại             |                                  1 |              1 |
| Lấy tổng số chưa đọc                |                                  1 |              1 |
| Tab bị ẩn                           |                                 25 |              0 |
| Ghi trạng thái đã đọc khi tab bị ẩn | 11 request, tương đương 22 lần ghi |              0 |

Khi quay lại tab, danh sách hội thoại, tin nhắn và số thông báo được cập nhật
trong khoảng một giây.

Các con số cần được hiểu đúng:

- Mức giảm 10 xuống 5 request tin nhắn một phần đến từ độ trễ của dev server.
  Trên server nhanh, chênh lệch này có thể nhỏ hơn.
- Mức giảm về 0 khi tab ẩn và giảm request `/read` là thay đổi cấu trúc, không
  phụ thuộc server nhanh hay chậm.
- Đây là số request, không phải phép đo CPU. Tuy vậy, request `/read` và chuông
  thông báo có thể quy đổi trực tiếp thành số lần đọc/ghi database.
- Dữ liệu thử còn ít. Số request mỗi trình duyệt không đổi khi dữ liệu tăng,
  nhưng mỗi request có thể nặng hơn.

## Khi thêm polling mới

Ví dụ:

```ts
usePolling(load, { intervalMs: 15_000, enabled: isPanelOpen });
```

Hãy truyền `enabled` nếu phần giao diện có thể đóng hoặc thu nhỏ. Cơ chế kiểm tra
tab chỉ biết người dùng có đang nhìn trình duyệt hay không; nó không biết panel
bên trong đang bị đóng. Nếu dữ liệu ban đầu đã được server render, thêm
`skipInitialRun: true` để tránh tải lại ngay cùng một dữ liệu.

## Từ ngữ cần nhớ

- **Request:** một lần trình duyệt gọi máy chủ.
- **Polling:** gọi lại request theo chu kỳ để tìm dữ liệu mới.
- **In flight:** request đã gửi nhưng chưa có kết quả.
- **Race condition:** hai tác vụ chạy gần nhau và kết quả phụ thuộc tác vụ nào
  hoàn tất trước.
- **Hook:** hàm React đóng gói logic dùng lại giữa các component.
