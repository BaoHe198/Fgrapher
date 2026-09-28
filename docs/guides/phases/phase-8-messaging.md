# Giai đoạn 8 — Tin nhắn

> Tài liệu lịch sử. Kế hoạch ban đầu đề xuất Socket.io; hệ thống hiện dùng polling.

## Mục tiêu

- Danh sách hội thoại.
- Khung chat và gửi tin.
- Unread/read receipt.
- Liên kết với booking/yêu cầu dịch vụ.
- Block và báo cáo nội dung.

## 1. Giao diện chat

Desktop có danh sách bên trái và hội thoại bên phải; mobile chuyển giữa hai màn hình.
Component cần:

- virtualize/phân trang khi tin nhiều;
- scroll hợp lý khi có tin mới;
- không kéo user khỏi vị trí đang đọc;
- composer có disabled/loading/error;
- timestamp theo locale;
- keyboard và screen reader.

## 2. Quyền truy cập

Mọi API đọc/gửi/đánh dấu đã đọc phải kiểm tra người gọi là
`ConversationParticipant`. ID hội thoại trong URL không phải bằng chứng quyền.

Khi một bên block bên kia, service gửi tin phải từ chối. Response không trả dữ liệu
participant ngoài nhu cầu UI.

## 3. Gửi tin

Server validate độ dài/type/attachment, tạo Message và cập nhật thông tin hội thoại
trong transaction khi cần. Client dùng temporary state nhưng phải thay bằng dữ liệu
server và xử lý gửi thất bại.

Attachment đi qua signed upload có purpose phù hợp; không cho purpose chat dùng quyền
portfolio/KYC và ngược lại.

## 4. Polling hiện tại

Polling gọi API định kỳ:

- chat mở: nhanh hơn;
- danh sách hội thoại: chậm hơn;
- unread count/notification: chậm hơn nữa.

Hook `usePolling` phải:

- dừng khi `document.hidden`;
- không chạy lần mới khi lần cũ chưa xong;
- refresh ngay khi tab visible;
- cleanup timer/AbortController;
- bỏ response của hội thoại cũ.

Không render hai bản chat desktop/mobile cùng lúc rồi ẩn bằng CSS vì cả hai có thể
poll.

## 5. Vì sao chưa dùng WebSocket?

WebSocket cho server đẩy tin gần realtime nhưng cần:

- server giữ kết nối;
- xác thực khi connect/reconnect;
- scale nhiều instance;
- presence/typing state;
- retry/order/dedup;
- quan sát và chi phí hạ tầng.

Polling đơn giản và đủ cho quy mô nhỏ. Chỉ đổi transport khi có số đo nhu cầu; service
và model tin nhắn nên không phụ thuộc cách vận chuyển.

## 6. Booking và service request

Tin hệ thống có thể chứa `booking_link` hoặc ngữ cảnh request/offer. Server tạo loại
tin này; client không được giả làm system message hoặc chèn URL tùy ý.

Chi tiết địa chỉ/liên hệ vẫn theo policy booking, không tự động lộ chỉ vì có hội thoại.

## 7. Kiểm duyệt và an toàn

- Escape nội dung; không render HTML người dùng trực tiếp.
- Block và report ở server.
- Rate limit gửi tin/upload.
- Không log nội dung nhạy cảm toàn phần.
- Retention/xoá dữ liệu theo chính sách.
- Admin chỉ xem khi có căn cứ và audit phù hợp.

## 8. Kiểm tra

- User ngoài hội thoại đọc/gửi/mark read;
- hai tab cùng gửi;
- polling khi tab ẩn/hiện;
- chuyển hội thoại khi request cũ chưa xong;
- block trước/sau khi mở chat;
- tin dài, rỗng, attachment sai;
- unread count và `lastReadAt`;
- mobile/keyboard/scroll;
- N+1 khi có nhiều hội thoại.

## Khác với kế hoạch ban đầu

Typing indicator và presence thật không nên được mô tả là realtime nếu chưa có
transport hỗ trợ. Tài liệu hiện hành phải nói rõ polling và độ trễ dự kiến.
