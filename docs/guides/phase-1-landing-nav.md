# Giai đoạn 1 — Landing page và điều hướng

> Tài liệu lịch sử. Dùng để hiểu mục tiêu thiết kế ban đầu; kiểm tra code hiện tại
> trước khi làm tiếp.

## Mục tiêu

- Tạo landing page công khai theo UI Kit.
- Áp design token, font, light/dark mode.
- Xây navigation responsive.
- Tạo component nền và `ArtistCard`.
- Thiết lập tiếng Việt/Anh.

## 1. Áp dụng design token

Nguồn tham khảo:

- `docs/design-reference/Fgrapher Web UI Kit.html`;
- `docs/design-reference/design-tokens.md`;
- `src/app/globals.css`.

Các token gồm màu xanh/vàng/neutral, màu theo ý nghĩa, typography, spacing, radius
và shadow. Khi sửa, dùng mapping thực tế trong `globals.css`; không đoán class từ
tên token vì shadcn và Tailwind có tên dễ va nhau.

Kiểm tra:

- light và dark mode;
- tương phản chữ/nền;
- dấu tiếng Việt không bị cắt;
- focus ring;
- responsive từ mobile tới desktop.

## 2. Logo và nhận diện

Logo “Dual Lens” gồm hai khung bo góc chồng nhau, dùng xanh và vàng. Asset cần:

- rõ ở kích thước nhỏ;
- có biến thể phù hợp nền sáng/tối;
- có accessible name;
- không dùng text trong SVG nếu wordmark cần dịch hoặc co giãn.

## 3. Navigation

Navigation gồm logo, link chính, tìm kiếm/đăng nhập/dashboard và menu mobile. Các yêu
cầu kỹ thuật:

- link active rõ;
- thao tác được bằng bàn phím;
- menu/dialog giữ focus;
- không render hai component có side effect rồi chỉ ẩn một bằng CSS;
- dark mode và locale không gây hydration mismatch.

## 4. Component dùng chung

Kế hoạch ban đầu tạo Button, Badge, Card, Input, Avatar và các primitive cần thiết.
Component phải có:

- variant có tên theo ý nghĩa;
- trạng thái hover/focus/disabled/loading;
- props đủ chặt bằng TypeScript;
- không hardcode chuỗi hiển thị;
- không gắn business logic vào primitive.

## 5. `ArtistCard`

Card nhà cung cấp hiển thị ảnh, tên, role, vị trí, rating và giá bắt đầu. Phiên bản
hiện tại còn có carousel và fallback avatar.

Điểm cần giữ:

- ảnh có kích thước và thumbnail;
- chỉ mount ảnh đang xem;
- tên dài không ép badge;
- provider mới hiển thị nhãn phù hợp thay vì “0 review” khó hiểu;
- toàn card/link có accessible name;
- dữ liệu chỉ gồm profile đã publish và media approved.

## 6. Landing page

Các vùng dự kiến:

1. hero và search;
2. role/category nhanh;
3. nhà cung cấp nổi bật;
4. cách hoạt động;
5. CTA cho nhà cung cấp;
6. footer.

Server Component nên lấy dữ liệu qua service. Client Component chỉ giữ tương tác như
carousel, search input hoặc menu.

## 7. Đa ngôn ngữ

`next-intl` quản lý locale và message. Mỗi key cần có ở cả
`src/messages/vi.json` và `en.json`. Tiếng Việt là trải nghiệm chính; ngày, tiền,
role và category phải qua helper/i18n thay vì map tiếng Anh dùng chung.

## 8. Kiểm tra

- Mobile 320/375 px, tablet và desktop.
- Menu, theme và locale bằng bàn phím.
- Không có hydration warning.
- Ảnh không gây layout shift lớn.
- Link và CTA tới route đang tồn tại/được bật.
- `pnpm lint`, `pnpm typecheck`, test liên quan và `pnpm build`.

## Khác với kế hoạch ban đầu

UI Kit chỉ có landing page, không đại diện đầy đủ cho dashboard. Dự án hiện dùng
Tailwind v4, token đã namespaced một phần, giao diện và feature flag đã mở rộng.
Luôn đọc `docs/design-reference/design-tokens.md` và code hiện tại thay cho prompt
cũ.
