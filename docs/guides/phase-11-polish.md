# Giai đoạn 11 — Hoàn thiện chất lượng, hiệu năng và trải nghiệm

> Tài liệu lịch sử. “Polish” không phải bước trang trí cuối; i18n, accessibility,
> error handling và hiệu năng cần được giữ trong mọi thay đổi.

## 1. Đa ngôn ngữ

- Tìm chuỗi hardcode trong UI, toast, email và metadata.
- Cùng key có ở `vi.json` và `en.json`.
- Tiếng Việt tự nhiên, dùng thuật ngữ thống nhất.
- Ngày/giờ qua helper với Asia/Ho_Chi_Minh.
- Tiền dùng VND đúng định dạng.
- Role/category không lấy map tiếng Anh trong locale Việt.
- Không dịch tên file, API, enum hoặc mã lỗi máy.

## 2. Responsive

Kiểm tra ít nhất:

- 320/375 px;
- tablet;
- laptop phổ biến;
- màn hình rộng.

Không chỉ “không tràn”: hành động chính phải dễ chạm, bảng có cách xem hợp lý, dialog
không vượt màn hình và navigation không mount side effect trùng.

## 3. Hiệu năng

Đo trước khi sửa:

- server response/query;
- số request;
- bundle/payload;
- LCP/CLS/INP;
- memory/CPU/kết nối database.

Ưu tiên:

- bỏ N+1;
- chạy query độc lập song song;
- phân trang/select;
- cache dữ liệu public phù hợp;
- dừng polling thừa;
- tối ưu ảnh/video;
- giảm Client Component và package nặng.

## 4. SEO

Trang public cần title/description/canonical phù hợp. Sitemap chỉ chứa feature đang
bật và hồ sơ/listing public. Robots chặn khu vực auth/dashboard/admin/API khỏi crawl
không cần thiết.

JSON-LD không được chứa email, phone, ngày sinh, địa chỉ chính xác hoặc dữ liệu riêng.
Không tạo hàng nghìn landing page mỏng chỉ bằng tổ hợp filter.

## 5. Accessibility

- heading theo thứ tự;
- label cho input;
- keyboard và focus visible;
- dialog giữ/trả focus;
- icon-only button có accessible name;
- status không chỉ dựa vào màu;
- tương phản WCAG;
- error được liên kết với field;
- reduce motion khi cần;
- ảnh có alt phù hợp.

Test bằng bàn phím và screen reader cơ bản, không chỉ chạy scanner.

## 6. Error handling

Mọi luồng có loading, empty và error state. Error message cho người dùng nói họ có
thể làm gì; log kỹ thuật giữ stack/context an toàn.

Error boundary không được nuốt lỗi thành màn hình trắng. Network timeout/retry cần
giới hạn. Nghiệp vụ chính đã thành công không rollback vì email/analytics phụ lỗi.

## 7. Edge case

- dữ liệu trống/dài;
- request chậm/lặp/đồng thời;
- user mất quyền trong lúc đang mở trang;
- feature flag đổi;
- timezone/cuối tháng;
- upload sai/gián đoạn;
- provider bị xoá/suspend;
- dịch vụ ngoài không cấu hình;
- mobile keyboard và back navigation.

## 8. Kiểm tra phát hành

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:smoke
```

Chạy E2E/visual phù hợp và checklist thủ công trên Preview. So network/log, không chỉ
nhìn ảnh.

## 9. Không nên làm

- tối ưu không có phép đo;
- thêm animation làm chậm thao tác;
- giảm font để nhét nội dung;
- blanket `try/catch` hoặc `IFERROR` tương đương che lỗi;
- tải trước mọi ảnh;
- tạo accessibility bằng tooltip thay cho label;
- coi Lighthouse 100 là bằng chứng toàn bộ trải nghiệm tốt.

## Khác với kế hoạch ban đầu

Dự án hiện đã có unit/integration test, cache, polling hook và nhiều audit cụ thể.
Đọc báo cáo mới nhất và số đo hiện tại trước khi lặp lại checklist cũ.
