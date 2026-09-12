---
name: fgrapher-seo-landing
description: Sinh nội dung và cấu trúc trang landing SEO của Fgrapher theo tổ hợp tỉnh/thành × role (ví dụ "chụp ảnh cưới tại Đà Nẵng"). BẮT BUỘC dùng skill này khi viết hoặc sửa landing page, metadata, tiêu đề trang, mô tả danh mục, breadcrumb, sitemap, structured data, nội dung marketing theo địa phương, hoặc bất kỳ trang nào có URL dạng /{role}/{tinh}. Cũng dùng khi được yêu cầu "viết nội dung cho trang X", "làm SEO", hay tạo template trang danh sách provider theo khu vực.
---

# Fgrapher — Landing page SEO theo tỉnh × role

Mục tiêu: 34 tỉnh × ~5 role ≈ 170 trang, nhất quán về cấu trúc, **không phải**
doorway page nhân bản nội dung.

## Nguyên tắc số một: không tạo trang rỗng

Google phạt trang mỏng và trang chỉ khác nhau ở tên địa danh. Vì vậy:

- **Chỉ render trang khi tỉnh đó có ít nhất 3 provider đã duyệt cho role đó.**
  Dưới ngưỡng → trả 404, hoặc redirect về trang role toàn quốc. Không noindex một
  trang rỗng rồi để đó.
- Ngưỡng này là tham số cấu hình (`MIN_PROVIDERS_FOR_LANDING`), không hardcode.
- Sitemap chỉ chứa trang đạt ngưỡng.

## URL và metadata

Cấu trúc URL:

```
/{role-slug}/{province-slug}
ví dụ: /chup-anh-cuoi/da-nang
       /trang-diem-co-dau/ho-chi-minh
```

- Slug tiếng Việt không dấu, chữ thường, gạch ngang
- Slug lấy từ bảng `Province`, không hardcode (xem skill `fgrapher-schema`)
- Không dùng query param cho tỉnh (`?province=`) — không SEO được

Metadata:

- `<title>`: `{Role} tại {Tỉnh} — {N}+ {role} đã xác minh | Fgrapher` (≤ 60 ký tự
  nếu có thể; ưu tiên cắt phần brand)
- `<meta description>`: 140–160 ký tự, nêu số lượng provider thật và khoảng giá
  thật, không nói chung chung
- `canonical` trỏ về chính nó; nếu có phân trang, `rel=next/prev`
- `hreflang`: chưa cần, MVP chỉ tiếng Việt

## Cấu trúc trang — thứ tự cố định

1. **H1**: `{Role} tại {Tỉnh}` — đúng một H1, không nhồi từ khoá
2. **Đoạn mở** (60–100 từ): số provider đang hoạt động, khoảng giá thực tế, các
   khu vực/phường phổ biến trong tỉnh đó
3. **Danh sách provider**: tối thiểu 6 card, ảnh đã `APPROVED`, có badge đã xác minh
4. **Khối nội dung địa phương** (H2): những gì _chỉ đúng với tỉnh này_ — địa điểm
   chụp phổ biến, mùa đẹp, mức giá vùng. Đây là phần chống trùng lặp.
5. **FAQ** (H2, 3–5 câu): câu hỏi thật, có structured data `FAQPage`
6. **Liên kết nội bộ**: các tỉnh lân cận cùng role + các role khác cùng tỉnh
7. **CTA**: đăng yêu cầu / trở thành provider

## Chống trùng lặp — quy tắc bắt buộc

Mỗi trang phải có **tối thiểu 150 từ nội dung duy nhất** không xuất hiện ở trang
tỉnh khác. Đặc biệt là khối số 4.

Cách tạo nội dung duy nhất — ưu tiên dữ liệu thật trước, viết tay sau:

- Số liệu lấy từ DB: số provider, khoảng giá p25–p75 thực tế, số booking hoàn thành
- Địa điểm: lấy từ dữ liệu provider tự khai, không bịa
- Nếu chưa có dữ liệu thật cho một tỉnh → trang đó chưa đạt ngưỡng, đừng render

**Không được làm:**

- Viết một template rồi thay tên tỉnh
- Bịa số liệu ("hơn 100 nhiếp ảnh gia" khi thực tế có 4)
- Bịa tên địa điểm hoặc đặc điểm vùng miền mà không kiểm chứng
- Nhồi từ khoá: mật độ từ khoá chính giữ dưới 2%

Nếu được yêu cầu sinh nội dung cho tỉnh chưa có dữ liệu, **nói rõ là chưa đủ dữ
liệu** thay vì viết nội dung nghe hay nhưng sai.

## Structured data

Mỗi trang cần JSON-LD:

- `BreadcrumbList`
- `FAQPage` (nếu có khối FAQ)
- `ItemList` cho danh sách provider
- Không dùng `LocalBusiness` cho Fgrapher trên trang tỉnh — Fgrapher không có cơ
  sở tại tỉnh đó. Dùng cho từng provider nếu họ có địa chỉ thật đã xác minh.

## Ảnh

- Chỉ dùng ảnh `ProfileMedia.moderationStatus === APPROVED`
- `alt` mô tả nội dung thật của ảnh, không nhồi từ khoá
- Ảnh có người nhận diện được phải có bản ghi consent (xem `fgrapher-compliance`)
- Lazy load tất cả trừ ảnh đầu tiên; ảnh đầu ưu tiên `priority`

## Giọng văn

- Tiếng Việt tự nhiên, xưng "Fgrapher", gọi người đọc là "bạn"
- Câu ngắn. Không dùng sáo ngữ marketing ("giải pháp toàn diện", "hàng đầu Việt Nam")
- Nêu con số cụ thể thay vì tính từ
- Không hứa điều platform không đảm bảo được (MVP chưa có thanh toán, chưa có giao
  file, nên đừng viết "thanh toán an toàn qua Fgrapher")

## Checklist trước khi publish một batch trang

- [ ] Mọi trang đều đạt ngưỡng provider tối thiểu?
- [ ] Mỗi trang có ≥150 từ nội dung duy nhất?
- [ ] Số liệu lấy từ DB, không bịa?
- [ ] Slug khớp với bảng `Province`?
- [ ] Không có ảnh `PENDING`/`REJECTED` lọt ra ngoài?
- [ ] Sitemap đã cập nhật, chỉ chứa trang đạt ngưỡng?
- [ ] Không có tuyên bố về tính năng chưa tồn tại (thanh toán, giao file)?
