# Báo cáo kiểm thử trải nghiệm thực tế — 22/09/2026

## Phạm vi và môi trường

- Môi trường: `http://localhost:3000`, dữ liệu local dùng chung.
- Bản mã trước khi kiểm thử: `58c4dde` — Claude đã commit phần cập nhật E2E với thông điệp `fix(test): work through the rest of the e2e drift, document what is left`.
- Vai trò đã đi qua: khách chưa đăng nhập, Customer, Photographer, Camera Shop, Costume Shop và Admin.
- Không tạo booking, yêu cầu, tin nhắn, đơn hàng hoặc thao tác duyệt mới. Thao tác thích Community đã được trả về trạng thái ban đầu.

## Các luồng đã hoạt động

| Luồng                                                                                 | Kết quả                                                                                            |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Community F: lọc tất cả / Portfolio / F Booking, bình luận và thích                   | Hoạt động; trạng thái danh sách cập nhật sau khi giao diện render lại.                             |
| Chợ F: mở sản phẩm cho thuê và chọn **Nhắn tin để thuê**                              | Hoạt động. Sau khoảng 1–2 giây chuyển tới `/dashboard/messages` và soạn sẵn nội dung gồm sản phẩm. |
| Fmap: chọn TP.HCM, ngày, giờ và Photographer; mở marker                               | Hoạt động, hiển thị giá, phường/xã, thời gian trống và liên kết hồ sơ/đặt lịch.                    |
| Tạo yêu cầu: chọn dịch vụ, thể loại, lịch linh hoạt, tỉnh rồi nạp danh sách phường/xã | Hoạt động.                                                                                         |
| Camera Shop: trang quản lý tin đăng và Chợ F                                          | Hiển thị 5 sản phẩm mẫu.                                                                           |
| Costume Shop: trang hồ sơ công khai, catalogue trang phục, nút nhắn tin thuê          | Hoạt động theo mô hình trao đổi trực tiếp, không đặt cọc hay đặt lịch trên web.                    |

## Lỗi cần sửa

### QA-01 — P0: Bộ lọc và tìm kiếm ở Tìm kiếm F không cập nhật kết quả ngay

**Cách tái hiện**

1. Đăng nhập Customer, mở `/browse`.
2. Nhập `Thanh Tâm` vào ô tìm kiếm, chờ hơn 600 ms.
3. URL thành `/browse?q=Thanh+T%C3%A2m` nhưng lưới vẫn hiển thị toàn bộ 8 kết quả.
4. Tải lại trang thì còn đúng 1 kết quả.
5. Lặp lại với checkbox `Cửa hàng máy ảnh (1)`: checkbox được chọn và URL thành `?roles=CAMERA_SHOP`, nhưng lưới vẫn giữ 8 kết quả đến khi tải lại.

**Kỳ vọng**: URL, số lượng và lưới kết quả phải đổi cùng một lượt điều hướng; có thể hiện trạng thái đang tải ngắn, nhưng không được để danh sách cũ trông như kết quả của bộ lọc mới.

**Điểm cần rà soát**: `src/components/browse/search-input.tsx`, `src/components/browse/filter-sidebar.tsx`, `src/components/browse/browse-filter-context.tsx`, `src/app/(public)/browse/page.tsx`. Đây là Server Component đọc `searchParams`; hãy kiểm tra cache/navigation của Next 16 và thêm kiểm thử hồi quy cho nhập từ khoá và chọn role mà không reload.

**Tiêu chí hoàn thành**: sau debounce 300 ms hoặc sau một click filter, thẻ kết quả, số lượng và URL đều phản ánh cùng dữ liệu trong điều hướng client đầu tiên.

### QA-02 — P0: Từ khoá ở Chợ F chỉ được áp dụng khi vô tình đổi một filter khác

**Cách tái hiện**

1. Mở `/shop`, nhập `Canon`, nhấn Enter và chờ hơn 2 giây.
2. Danh sách vẫn 5 sản phẩm, URL không thêm `q=Canon`.
3. Khi chọn thêm loại `Cho thuê`, truy vấn mới mang cả từ khoá `Canon` và kết quả mới thay đổi. Điều này cho thấy state từ khoá tồn tại nhưng submit/điều hướng không áp dụng ổn định.

**Kỳ vọng**: Enter, rời ô nhập và thao tác tìm kiếm phải cập nhật URL/lưới ngay, không phụ thuộc vào filter khác.

**Điểm cần rà soát**: `src/components/shop/shop-filters.tsx`, `src/app/(public)/shop/page.tsx`, `src/services/marketplace.ts`. Kiểm tra nguyên nhân client navigation giống QA-01 và đồng bộ lại state khi URL đổi bằng back/forward.

**Tiêu chí hoàn thành**: tìm `Canon` chỉ còn các sản phẩm phù hợp ngay sau Enter; xoá từ khoá trả lại toàn bộ kết quả; có test cho Enter và onBlur.

### QA-03 — P0: Photographer không thấy yêu cầu phù hợp vì hai nguồn địa điểm không đồng bộ

**Bằng chứng**

- Customer có hai yêu cầu mở `YC-2026-00001` và `YC-2026-00002`, cùng role `PHOTOGRAPHER`, thể loại `PORTRAIT`, TP.HCM/phường Thủ Đức.
- `photographer@test.com` có role Photographer **VERIFIED**, hồ sơ published và xuất hiện đúng trên Fmap tại TP.HCM.
- `/dashboard/opportunities` vẫn trả trạng thái rỗng.
- Kiểm tra dữ liệu xác nhận profile này có `serviceAreas = []` và `servesNationwide = false`; trong khi `listOpportunitiesForProvider` chỉ ghép theo `ProfileServiceArea.provinceId`. Vì vậy địa chỉ hiển thị/hồ sơ và dữ liệu ghép cơ hội là hai nguồn khác nhau.

**Kỳ vọng**: provider mới lưu địa chỉ chính phải được ghép với yêu cầu cùng tỉnh ngay cả khi chưa chủ động mở phần “Khu vực phục vụ”; hoặc UI bắt buộc/giải thích rõ việc chọn khu vực phục vụ trước khi công khai hồ sơ. Không được hiển thị provider trên Fmap ở một khu vực rồi báo không có cơ hội phù hợp tại chính khu vực đó.

**Điểm cần rà soát**: `src/services/request-offers.ts`, `src/app/api/profiles/[role]/service-areas/route.ts`, form hồ sơ provider và seed/migration. Cần quyết định một nguồn chân lý: tự đưa `Profile.provinceId` vào service areas khi lưu hồ sơ, hoặc ghép cơ hội có fallback rõ ràng về tỉnh chính. Backfill dữ liệu hiện có.

**Tiêu chí hoàn thành**: provider đã xác thực, công khai, có địa chỉ ở TP.HCM thấy hai yêu cầu nêu trên; provider khác role/ngoài khu vực không thấy; chính Customer không thể thấy yêu cầu của mình dưới vai trò provider. Bổ sung E2E hoặc integration test cho cả ba trường hợp.

### QA-04 — P0: Camera Shop có sản phẩm ở Chợ F nhưng trang hồ sơ lại báo chưa có sản phẩm

**Cách tái hiện**

1. Mở `/shop`: có 5 sản phẩm của `Văn Long Camera`; chính tài khoản shop cũng thấy 5 tin trong `/dashboard/listings`.
2. Mở `/profile/vanlonghoang`, tab `Sản phẩm`: hiện `Shop chưa đăng sản phẩm nào.`

**Nguyên nhân nhiều khả năng**: `getShopProducts` trong `src/services/public-profile.ts` lọc category qua `productCategoriesForRole`. Danh mục dữ liệu/seed hiện dùng nhãn cũ tiếng Việt, trong khi validation hiện dùng mã/danh mục tiếng Anh như `Camera body`, `Lens`, nên truy vấn profile loại hết các sản phẩm. Đây cũng là rủi ro với dữ liệu production cũ.

**Kỳ vọng**: mọi sản phẩm active của Camera Shop xuất hiện nhất quán ở Chợ F, quản lý tin đăng và tab Sản phẩm hồ sơ; sản phẩm nhấp được để mở trang chi tiết.

**Tiêu chí hoàn thành**: migration/backfill an toàn hoặc query tương thích dữ liệu cũ; seed và validation thống nhất; thêm test profile Camera Shop có sản phẩm hiển thị.

### QA-05 — P1: Bản tiếng Việt còn nhãn tiếng Anh ở trang chi tiết sản phẩm

**Cách tái hiện**: mở một sản phẩm Chợ F bằng giao diện VI, ví dụ DJI Ronin. Các nhãn `New`, `Message`, `2 in stock` vẫn là tiếng Anh dù phần còn lại bằng tiếng Việt.

**Kỳ vọng**: mọi nhãn hiển thị cho người dùng theo locale VI, bao gồm tình trạng sản phẩm, tồn kho, CTA và đơn vị.

**Điểm cần rà soát**: product detail/card và `src/messages/vi.json`. Thêm test/kiểm tra không còn chuỗi UI tiếng Anh ở trang `/shop/[id]` với locale VI.

### QA-06 — P1: Cần làm rõ đường vào quản lý catalogue của Costume Shop

Catalogue của Costume Shop **đã tồn tại đúng kiến trúc**: quản lý ở Cài đặt → Hồ sơ qua `CostumesManager`, hiển thị công khai và khách nhắn tin để thuê. Đây phù hợp với yêu cầu không booking/lịch bận/đặt cọc trên web.

Tuy nhiên sidebar vẫn không có lối vào dễ nhận biết như `Quản lý trang phục`; truy cập `/dashboard/listings` lại báo chỉ Camera Shop được dùng. Người dùng dễ kết luận shop chưa có chức năng đăng sản phẩm.

**Đề nghị**: giữ costume catalogue tách khỏi Chợ F (tránh trộn quần áo với thiết bị), nhưng thêm mục sidebar/CTA rõ ràng `Trang phục của tôi` dẫn tới đúng tab Cài đặt → Hồ sơ. Không thêm Portfolio, booking, lịch bận cho Costume Shop.

### QA-07 — P1: Khách chưa đăng nhập không nhìn thấy Chợ F và Community F trong header desktop

Ở landing page khi chưa đăng nhập, header chỉ có Tìm kiếm, Fmap, Booking, Giới thiệu; sau đăng nhập mới có Chợ F và Community F. Trong khi hai URL này là trang công khai.

**Đề nghị sản phẩm**: đưa hai liên kết vào header cho visitor để tăng khả năng khám phá. Nếu chủ ý yêu cầu đăng nhập, cần dẫn người dùng rõ ràng thay vì ẩn hoàn toàn. Cần xác nhận quyết định UX trước khi thay đổi.

### QA-08 — P2: Bước địa điểm của Tạo yêu cầu chưa giải thích tính bắt buộc

Sau khi chọn tỉnh TP.HCM, nút Tiếp tục đã bật dù chưa chọn phường/xã hay địa chỉ. Điều này có thể đúng nếu Customer muốn tìm provider toàn tỉnh, nhưng không rõ ràng trong luồng.

**Đề nghị**: ghi rõ `Phường/Xã (không bắt buộc)` và giải thích chọn phường giúp ghép chính xác hơn; hoặc yêu cầu phường nếu nghiệp vụ chỉ ghép ở mức địa phương. Quyết định này cần thống nhất với QA-03.

### QA-09 — P2: Cải thiện LCP cho ảnh đầu trang

Next cảnh báo ảnh Cloudinary ở vùng nhìn thấy đầu tiên có thể là LCP và nên ưu tiên tải. Rà soát thẻ ảnh hero/card đầu trang; thêm `priority`/`fetchPriority` chỉ cho ảnh LCP thực sự, không áp dụng hàng loạt.

## Thứ tự Claude nên xử lý

1. **P0 QA-01 và QA-02**: xử lý chung cơ chế điều hướng client/filter, kiểm thử không reload.
2. **P0 QA-03**: sửa nguồn dữ liệu khu vực phục vụ và backfill an toàn, có regression test.
3. **P0 QA-04**: đồng bộ danh mục sản phẩm cũ/mới để hồ sơ Camera Shop không trống.
4. **P1 QA-05, QA-06**: i18n và lối vào catalogue Costume Shop.
5. **QA-07 đến QA-09**: xử lý sau khi xác nhận quyết định UX/độ ưu tiên.

## Yêu cầu thực hiện và kiểm thử

- Làm trên worktree/branch riêng, không đụng vào công việc khác đang dở.
- Dùng Sonnet cho QA-01, QA-02, QA-04, QA-05, QA-06; dùng Opus cho QA-03 vì có thay đổi quy tắc ghép, dữ liệu và migration/backfill.
- Mỗi nhóm logic là một commit dễ review. Không push/deploy khi chưa có yêu cầu riêng.
- Chạy lint/typecheck và targeted tests. Với các lỗi P0, bổ sung test bảo vệ đúng trường hợp tái hiện bên trên.

---

## Kết quả xử lý (nhánh `fix/qa-2026-09-22`)

Mỗi mục được tái hiện lại trên máy trước khi sửa, và kiểm tra lại sau khi sửa
bằng trình duyệt thật chạy với dữ liệu dev.

| Mã    | Trạng thái | Commit                                                       | Ghi chú                                                                                                                                                                                           |
| ----- | ---------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QA-01 | Đã sửa     | `fix(search): one owner for the filter query…`               | Nguyên nhân không phải điều hướng. Thanh lọc ghi lại toàn bộ query string từ một object không có trường `q`, nên **mọi** lần bấm filter đều xoá từ khoá đang tìm.                                 |
| QA-02 | Đã sửa     | cùng commit trên                                             | Cùng một loại lỗi trên `/shop`: mỗi ô lọc dựng query từ URL trình duyệt đã chốt, nên ô chạm sau ghi đè ô chạm trước. Không ổn định theo đúng nghĩa đen — tuỳ điều hướng trước đã về kịp hay chưa. |
| QA-03 | Đã sửa     | `fix(search): match opportunities the same way…`             | Hai nguồn địa điểm đã hợp nhất, có migration backfill. Chi tiết bên dưới.                                                                                                                         |
| QA-04 | Đã sửa     | `fix(marketplace): one spelling for a product category`      | Migration đổi nhãn tiếng Việt trong `Product.category` sang mã chuẩn; truy vấn vẫn chấp nhận nhãn cũ.                                                                                             |
| QA-05 | Đã sửa     | `fix(i18n): translate the Chợ F labels…`                     | `New` hoá ra là nhãn "chưa có đánh giá" của shop chứ không phải tình trạng sản phẩm.                                                                                                              |
| QA-06 | Đã sửa     | `feat(ui): give a costume shop a way into its own catalogue` | Catalogue giữ nguyên vị trí; chỉ thêm lối vào và sửa lại thông báo sai.                                                                                                                           |
| QA-07 | Chưa làm   | —                                                            | Là quyết định sản phẩm, báo cáo cũng nói cần xác nhận UX trước.                                                                                                                                   |
| QA-08 | Chưa làm   | —                                                            | Phụ thuộc quyết định ở QA-07/QA-03 (xem bên dưới).                                                                                                                                                |
| QA-09 | Chưa làm   | —                                                            | Chưa đo LCP thật; `priority` đã có sẵn cho 4 thẻ đầu ở `/browse`.                                                                                                                                 |

### QA-01 và QA-02 — điều đã tìm ra khác với giả thiết ban đầu

Báo cáo mô tả "URL đổi nhưng lưới không đổi cho tới khi tải lại". Chạy lại thì
URL và lưới **luôn** đổi cùng lúc: Next.js chỉ cập nhật thanh địa chỉ khi nội
dung mới đã sẵn sàng. Thứ thật sự hỏng là từ khoá bị xoá âm thầm, nên kết quả
sau khi bấm filter trông đúng như "bộ lọc không áp dụng" — ví dụ `?q=Thanh`
(2 kết quả) + bấm "Mới nhất" → `?sort=newest` và 8 kết quả trở lại.

Phần "danh sách cũ trông như kết quả mới" là thật và đã xử lý riêng: cả hai
trang giờ hiện dòng "Đang cập nhật kết quả…" đè lên lưới cũ, thay vì chỉ làm mờ.

### QA-03 — quyết định đã chọn

Làm **cả hai** hướng báo cáo nêu, vì mỗi hướng một mình vẫn để hở:

- Khi lưu hồ sơ, tỉnh chính được ghi luôn vào `ProfileServiceArea`
  (`isPrimary = true`) — đúng điều comment trong `schema.prisma` đã hứa từ đầu
  nhưng chưa dòng code nào thực hiện.
- Khi ghép cơ hội, bộ lọc tỉnh được dựng **từ** `provinceMatch()` của `/browse`
  chứ không viết lại, nên hai bên không thể lệch nhau lần nữa.

Migration backfill dữ liệu sẵn có (8 hồ sơ trên dev), chỉ đụng dữ liệu, có câu
lệnh hoàn tác ghi trong file.

Không nới lỏng bất cứ chốt chặn nào: role phải đang hoạt động và đã xác minh
danh tính, khách không thấy yêu cầu của chính mình, "không có khu vực nào" vẫn
là "không ghép ở đâu cả" chứ không phải "toàn quốc".

### QA-08 vẫn cần chủ dự án quyết

Sau QA-03, provider được ghép theo **tỉnh**. Nếu khách bỏ trống phường/xã thì
yêu cầu vẫn tới đúng provider trong tỉnh đó. Câu hỏi còn lại là có muốn ghi rõ
"Phường/Xã (không bắt buộc)" hay bắt buộc chọn để ghép sát hơn — đây là lựa
chọn nghiệp vụ, không phải lỗi.
