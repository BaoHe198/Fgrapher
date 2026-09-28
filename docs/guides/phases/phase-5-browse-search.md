# Giai đoạn 5 — Tìm kiếm và khám phá

> Tài liệu lịch sử của mốc MVP tìm kiếm nhà cung cấp.

## Mục tiêu

- Trang `/browse` với filter và kết quả.
- Search bằng Prisma.
- Lọc địa điểm, giá, role, category và rating.
- Tạo landing page SEO khi phù hợp.

## 1. Bố cục

Desktop có filter sidebar và vùng kết quả; mobile dùng filter sheet. Hai giao diện
phải dùng chung state/provider, tránh render hai filter độc lập gây request hoặc lựa
chọn lệch nhau.

Kết quả có:

- tiêu đề và số lượng;
- sort;
- card grid;
- loading skeleton;
- empty/error state;
- phân trang hoặc giới hạn.

## 2. State bộ lọc

URL search params là trạng thái có thể chia sẻ. Giao diện có optimistic state để phản
hồi nhanh, nhưng nhiều click liên tiếp phải được gộp đúng.

- Text search dùng debounce.
- Checkbox/select có thể batch navigation.
- Kết quả response cũ về muộn không được ghi đè query mới.
- Back/forward của trình duyệt phải khôi phục filter.
- Clear filter phải xoá đúng params.

## 3. Search service

Service server:

- validate query;
- chỉ lấy profile `isPublished` hợp lệ;
- lọc role/location/category/price/rating;
- dùng sort allow-list;
- giới hạn page size;
- `select` dữ liệu public cần thiết;
- gom nhiều profile của cùng user;
- lấy rating/media bằng số query có kiểm soát.

Không ghép SQL từ chuỗi người dùng. Prisma query vẫn cần index và đo hiệu năng.

## 4. Tìm kiếm văn bản

MVP có thể dùng `contains` không phân biệt hoa thường. Full-text search chỉ nên thêm
khi dữ liệu/quy mô chứng minh cần thiết. Cần quyết định:

- trường nào được tìm;
- xử lý dấu tiếng Việt;
- trọng số tên so với mô tả;
- typo/fuzzy search;
- ranking và tie-break ổn định.

Không gọi “relevance” nếu thực tế chỉ sort theo rating hoặc ngày.

## 5. Địa điểm

Province/Ward lấy từ database/API. Profile có địa điểm chính, vùng phục vụ hoặc
`servesNationwide`.

Kết quả toàn quốc bổ sung nên hiển thị ở nhóm riêng để người dùng hiểu đó không phải
khớp địa điểm trực tiếp.

## 6. Card kết quả

`ArtistCard` hiển thị dữ liệu public, ảnh approved và fallback rõ. Carousel chỉ
mount ảnh hiện tại. Tên/role dài không làm card lệch; provider mới không bị hiển thị
rating giả.

## 7. Social feed

Kế hoạch cũ gộp social vào giai đoạn này. Hiện social nằm sau
`SOCIAL_FEED_ENABLED`; không được bật ngầm khi sửa browse.

## 8. SEO

Landing page theo role/tỉnh chỉ nên tạo cho tổ hợp có nội dung thật. Metadata, sitemap
và JSON-LD không chứa PII. Canonical URL tránh index nhiều URL filter gần giống nhau.

## 9. Kiểm tra

- click filter nhanh không mất lựa chọn;
- back/forward và URL chia sẻ đúng;
- role/marketplace flag off không lọt qua query param;
- public result không có PII/media pending;
- query có page limit và index;
- mobile sheet và desktop cùng state;
- không tải nhiều ảnh hơn cần thiết;
- tiếng Việt, VND và địa danh đúng.

## Khác với kế hoạch ban đầu

Search hiện có cache cho một số dữ liệu công khai, profile nhiều vai trò, service area
và nhiều tối ưu card. Đọc `src/services/search.ts` và component filter hiện tại để
hiểu cơ chế batching trước khi sửa.
