---
name: fgrapher-seo-landing
description: Sinh nội dung và cấu trúc trang landing SEO của Fgrapher theo tổ hợp tỉnh/thành × role (ví dụ "photographer tại TP. Hồ Chí Minh"). BẮT BUỘC dùng skill này khi viết hoặc sửa trang /{roleSlug}/{provinceSlug}, metadata, tiêu đề trang, mô tả danh mục, breadcrumb, sitemap, structured data, hoặc nội dung marketing theo địa phương. Cũng dùng khi được yêu cầu "viết nội dung cho trang X", "làm SEO", hay tạo template trang danh sách provider theo khu vực.
---

# Fgrapher — Landing page SEO theo tỉnh × role

## Hiện trạng — đọc trước khi đề xuất bất cứ gì

Trang **đã tồn tại**: `src/app/(public)/[roleSlug]/[provinceSlug]/page.tsx` (~170 dòng).
Đây là cái cần sửa, không phải viết mới.

| Thứ       | Thực tế trong repo                                                                     |
| --------- | -------------------------------------------------------------------------------------- |
| URL       | `/{roleSlug}/{provinceSlug}` — ví dụ `/photographer/tp-ho-chi-minh`                    |
| Role slug | `ROLE_SLUGS` trong `src/lib/constants/index.ts` — **slug tiếng Anh**, 6 role           |
| Tỉnh slug | `Province.code` (không có field `slug`) — xem skill `fgrapher-schema`                  |
| Dữ liệu   | `searchProfiles({ roles, city: province.code, limit: 24 })` (`services/search.ts`)     |
| Metadata  | catalog `publicPages.roleProvinceLanding` trong `src/messages/{vi,en}.json`            |
| JSON-LD   | `CollectionPage` + `ItemList` — **chưa có** `BreadcrumbList`, **chưa có** `FAQPage`    |
| Sitemap   | `src/app/sitemap.ts` — liệt kê **mọi** tổ hợp (role × tỉnh)                            |
| Render    | Dynamic, cố ý **không** `generateStaticParams()` — đọc comment đầu file để biết vì sao |

**Số trang hiện tại là 6, không phải 170.** Chỉ 1 tỉnh được seed (Hồ Chí Minh) ×
6 role slug. `CAMERA_SHOP` còn bị loại thêm khi `MARKETPLACE_ENABLED=false` → thực
tế là 5. Đừng viết plan, nội dung hay ước lượng dựa trên "34 tỉnh".

## Nguyên tắc số một: không tạo trang rỗng

Google phạt trang mỏng và trang chỉ khác nhau ở tên địa danh.

**Khoảng cách so với hiện trạng — đây là việc cần làm, chưa phải việc đã có:**

- Hiện tại trang **không** 404 khi không có provider nào — nó render empty state
  (`publicPages.roleProvinceLanding.empty`) kèm link về `/browse`
- Hiện tại **không có** hằng số ngưỡng nào
- `sitemap.ts` hiện **đưa mọi tổ hợp vào sitemap**, kể cả tổ hợp rỗng

Hướng đúng khi được giao làm phần này:

- Chỉ render khi tỉnh đó có **≥ N provider đã publish** cho role đó; dưới ngưỡng →
  404 hoặc redirect về trang role toàn quốc. Không noindex một trang rỗng rồi để đó.
- N là hằng số cấu hình (`MIN_PROVIDERS_FOR_LANDING` trong `src/lib/constants/index.ts`),
  không hardcode rải rác
- `sitemap.ts` phải dùng **cùng** một điều kiện đó, không được lệch
- Empty state hiện tại vẫn hữu ích cho người dùng vào thẳng URL — giữ nó, chỉ
  đừng để Google index

## Metadata

Template hiện tại nằm trong catalog i18n, không hardcode trong `.tsx`:

```
metaTitle:       "{role} tại {province} — Fgrapher"
metaDescription: "Tìm và đặt lịch {role} uy tín tại {province}. ..."
```

Khi cải thiện:

- `<title>` ≤ 60 ký tự nếu có thể; ưu tiên cắt phần brand
- `<meta description>` 140–160 ký tự, nêu **số provider thật và khoảng giá thật**
  thay vì câu chung chung — nghĩa là phải truyền số từ query vào message, không
  viết cứng trong catalog
- `canonical` đã có (`alternates.canonical`), trỏ về chính nó
- `hreflang`: **không áp dụng.** App dùng next-intl theo cookie, không có segment
  `[locale]` trong URL (xem `src/i18n/`), nên một URL phục vụ cả EN lẫn VI — không
  có URL riêng theo ngôn ngữ để khai báo.
- **Mọi chuỗi mới phải vào cả `vi.json` và `en.json`**, không hardcode tiếng Việt
  trong component

## Cấu trúc trang — thứ tự mục tiêu

Hiện trang mới có mục 1, 2, 3. Các mục còn lại là việc chưa làm:

1. **H1**: `{Role} tại {Tỉnh}` — đúng một H1, không nhồi từ khoá ✅ đã có
2. **Đoạn mở** (60–100 từ): số provider đang hoạt động, khoảng giá thực tế, các
   phường/khu vực phổ biến — ⚠️ hiện là câu template cố định, chưa có số thật
3. **Danh sách provider**: `ArtistCard`, tối đa 24 ✅ đã có
4. **Khối nội dung địa phương** (H2): những gì _chỉ đúng với tỉnh này_ — địa điểm
   chụp phổ biến, mùa đẹp, mức giá vùng. Đây là phần chống trùng lặp. ❌ chưa có
5. **FAQ** (H2, 3–5 câu) + structured data `FAQPage` ❌ chưa có
6. **Liên kết nội bộ**: tỉnh lân cận cùng role + role khác cùng tỉnh ❌ chưa có
   (lưu ý: chỉ có 1 tỉnh nên "tỉnh lân cận" hiện chưa dựng được)
7. **CTA**: đăng yêu cầu (`ServiceRequest`) / trở thành provider ❌ chưa có

## Chống trùng lặp — quy tắc bắt buộc

Mỗi trang phải có **tối thiểu 150 từ nội dung duy nhất** không xuất hiện ở trang
tỉnh khác, chủ yếu ở mục 4.

Ưu tiên dữ liệu thật trước, viết tay sau:

- Số liệu lấy từ DB: số provider đã publish, khoảng giá p25–p75 từ `Profile.priceMin/priceMax`,
  số booking `COMPLETED`
- Địa điểm: lấy từ dữ liệu provider tự khai (`Profile.address`, `Ward.name`), không bịa
- Nếu chưa có dữ liệu thật cho một tỉnh → tỉnh đó chưa đạt ngưỡng, đừng render

**Không được làm:**

- Viết một template rồi thay tên tỉnh
- Bịa số liệu ("hơn 100 nhiếp ảnh gia" khi thực tế có 4)
- Bịa tên địa điểm hoặc đặc điểm vùng miền mà không kiểm chứng
- Nhồi từ khoá: mật độ từ khoá chính giữ dưới 2%

Nếu được yêu cầu sinh nội dung cho tỉnh chưa có dữ liệu, **nói rõ là chưa đủ dữ
liệu** thay vì viết nội dung nghe hay nhưng sai. Với repo hiện tại, điều này đúng
với **mọi tỉnh trừ Hồ Chí Minh** — và HCMC cũng chỉ có dữ liệu seed.

## Structured data

Dùng `jsonLdScriptProps()` từ `src/lib/utils.ts` (pattern chung của repo, xem
thêm trang `/profile/[username]` và `/shop/[productId]`).

- `CollectionPage` + `ItemList` ✅ đã có
- `BreadcrumbList` ❌ nên thêm
- `FAQPage` ❌ thêm cùng lúc với khối FAQ, không thêm schema cho nội dung không tồn tại
- **Không** dùng `LocalBusiness` cho Fgrapher trên trang tỉnh — Fgrapher không có
  cơ sở tại tỉnh đó. Dùng cho từng provider nếu họ có địa chỉ thật đã xác minh.

## Ảnh

- Chỉ ảnh `ProfileMedia.moderationStatus === APPROVED` — `services/search.ts` đã
  lọc sẵn ở tầng query, đừng bypass bằng query Prisma riêng
- `alt` mô tả nội dung thật của ảnh, không nhồi từ khoá
- Ảnh có người nhận diện được phải có `rightsConfirmedAt` (xem `fgrapher-compliance`)
- Lazy load tất cả trừ ảnh đầu tiên; ảnh đầu ưu tiên `priority`
- Cloudinary chưa từng round-trip thật qua `next/image` trong môi trường này
  (xem CLAUDE.md) — kiểm tra bằng mắt khi có credential thật, đừng mặc định là chạy

## Giọng văn

- Tiếng Việt tự nhiên, xưng "Fgrapher", gọi người đọc là "bạn"
- Câu ngắn. Không dùng sáo ngữ marketing ("giải pháp toàn diện", "hàng đầu Việt Nam")
- Nêu con số cụ thể thay vì tính từ
- Tiền định dạng `"1.500.000₫"` qua `formatCurrency()`, ngày `dd/MM/yyyy` (CLAUDE.md mục 10)
- Không hứa điều platform không đảm bảo được: MVP **chưa bật** thanh toán online
  (`BILLING_ENABLED`/`MOMO_ENABLED`/`ZALOPAY_ENABLED`/`BANK_TRANSFER_ENABLED` đều
  `false`) và **không có** giao file qua platform — nên đừng viết "thanh toán an
  toàn qua Fgrapher" hay "nhận ảnh ngay trên Fgrapher"

## Checklist trước khi publish một batch trang

- [ ] Mọi trang đều đạt ngưỡng provider tối thiểu (khi ngưỡng đã được dựng)?
- [ ] `sitemap.ts` dùng đúng cùng điều kiện với trang, không lệch?
- [ ] Mỗi trang có ≥150 từ nội dung duy nhất?
- [ ] Số liệu lấy từ DB, không bịa?
- [ ] Slug role khớp `ROLE_SLUGS`, slug tỉnh khớp `Province.code`?
- [ ] Chuỗi mới đã có đủ trong cả `vi.json` và `en.json`?
- [ ] Không có ảnh `PENDING`/`REJECTED`/`AUTO_REJECTED` lọt ra ngoài?
- [ ] Không có structured data mô tả khối nội dung chưa tồn tại trên trang?
- [ ] Không có tuyên bố về tính năng đang tắt sau feature flag?
