# Báo cáo lịch sử: feature flag và cron trước khi ra mắt

> Báo cáo ghi lại code tại thời điểm audit. Hãy xem `src/lib/features.ts`,
> `vercel.json` và route hiện tại để biết trạng thái mới nhất.

## 1. Cách audit feature flag

Một flag chỉ an toàn khi được kiểm tra ở mọi đường vào:

1. điều hướng trực tiếp tới trang;
2. gọi API trực tiếp;
3. link cũ trong email/sitemap;
4. menu, count, notification và dữ liệu liên quan;
5. luồng tạo role/profile ở server.

Chỉ ẩn nút không đủ vì người dùng có thể tự gửi HTTP request.

## 2. `BILLING_ENABLED`

Kết quả lúc audit: phần Stripe được chặn khá đầy đủ.

- Trang billing hiển thị nội dung thay thế khi tắt.
- Onboarding bỏ qua bước Stripe.
- API Stripe và webhook trả 404 khi flag tắt.
- Đăng ký chuyển sang gói miễn phí theo policy lúc đó.
- Link cũ vẫn trỏ tới một trang hợp lệ thay vì trang chết.

Điểm cần nhớ: `BILLING_ENABLED` chỉ nói về Stripe. Việc cấp miễn phí và các cổng
Việt Nam phải có flag riêng; không suy ra “Stripe tắt” đồng nghĩa “mọi role đều
miễn phí”.

## 3. `MARKETPLACE_ENABLED`

Trang sản phẩm, giỏ hàng, checkout và phần lớn API marketplace đã được chặn. Tuy
nhiên audit tìm thấy lỗ hổng ở đường tạo role:

- validation server từng chấp nhận `CAMERA_SHOP` dù flag tắt;
- endpoint đổi role từng nhận cả enum `Role`;
- cùng endpoint có thể nhận `ADMIN`, tạo lỗi nâng quyền nghiêm trọng;
- profile CAMERA_SHOP có thể được tạo/publish và xuất hiện trong search.

Điều này tách thành hai vấn đề:

1. máy móc shop đã tắt;
2. role/profile đại diện cho shop chưa bị chặn ở mọi server path.

Checklist đúng:

- lọc role ở validation và service;
- cấm ADMIN tuyệt đối trong endpoint tự phục vụ;
- kiểm tra flag khi đăng ký, thêm/đổi role, tạo/publish profile và search;
- loại dữ liệu khỏi count/sitemap/notification khi tắt;
- có test API trực tiếp cho flag off.

## 4. `SOCIAL_FEED_ENABLED`

Tại thời điểm audit, follow/social chưa có nhiều bề mặt và các phần đã tồn tại được
chặn tương đối rõ. Khi phát triển thêm post/like/comment, phải lặp lại audit qua
trang, API, search/count, thông báo và dữ liệu cũ.

## 5. Cron

Audit kiểm tra các công việc Vercel chạy theo lịch và phát hiện hai loại rủi ro.

### Secret thiếu nhưng route vẫn chạy

Guard điều kiện cũ bỏ qua auth khi `CRON_SECRET` không được cấu hình. Mọi cron phải
trả 401/500 khi thiếu secret thay vì coi đó là môi trường không cần bảo vệ.

### Lịch chạy không khớp gói Vercel

Vercel Hobby giới hạn lịch cron. Một job cần chạy mỗi vài phút có thể thực tế chỉ
chạy mỗi ngày hoặc không được chấp nhận. Với email retry, lịch quá thưa làm email
chậm nhiều giờ.

Cần chọn rõ:

- nâng gói Vercel;
- dùng scheduler ngoài gọi endpoint có secret;
- hoặc chấp nhận lịch thưa và cập nhật SLA/tài liệu.

## 6. Checklist thêm cron mới

- [ ] Route bắt buộc `CRON_SECRET` và fail closed.
- [ ] Job an toàn khi chạy lặp.
- [ ] Hai lần chạy đồng thời không xử lý cùng dòng hai lần.
- [ ] Query có batch/limit, không quét vô hạn.
- [ ] Có log số dòng thành công/thất bại nhưng không log secret.
- [ ] Lịch phù hợp giới hạn gói deploy.
- [ ] Có cảnh báo nếu nhiều lần liên tiếp không chạy hoặc lỗi.
- [ ] `vercel.json` và tài liệu vận hành cùng một lịch.

## 7. Kết luận

Feature flag là ranh giới nghiệp vụ phía server, không phải mẹo ẩn giao diện. Cron
là API production có quyền thay đổi dữ liệu, nên cần auth, idempotency, giới hạn tài
nguyên và giám sát giống các endpoint nhạy cảm khác.
