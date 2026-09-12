# Vận hành Fgrapher trên production

Tài liệu này viết bằng tiếng Việt và viết cho **chủ dự án** — người vận hành
website hằng ngày nhưng không trực tiếp viết code. Nó trả lời: làm sao biết web
đang lỗi, nhận lỗi từ người dùng thế nào, sửa ra sao, kiểm tra gì trước khi đưa
lên, đưa lên bằng cách nào, và quay lui ra sao khi hỏng.

Các tài liệu kỹ thuật sâu hơn nằm cùng thư mục `docs/` và **viết bằng tiếng Anh**
vì chúng dành cho lập trình viên. Tài liệu này không chép lại chúng, chỉ chỉ chỗ:

| Cần biết gì                                                                       | Đọc file nào                                     |
| --------------------------------------------------------------------------------- | ------------------------------------------------ |
| Thao tác quản trị chi tiết (khoá tài khoản, xoá dữ liệu, hoàn tiền, hỗ trợ khách) | `docs/OPERATIONS.md`                             |
| Quy tắc đổi cấu trúc database, cách quay lui migration                            | `docs/MIGRATIONS.md`                             |
| Quy trình lập trình, cách thêm trang/API/vai trò mới                              | `docs/DEVELOPMENT.md`                            |
| Ba môi trường (local / preview / production) khác nhau ra sao                     | `docs/ENVIRONMENTS.md`                           |
| Việc thủ công còn tồn đọng                                                        | `docs/ops/Fgrapher-checklist-viec-thu-cong.xlsx` |

---

## 1. Ba môi trường — nhớ kỹ phần này trước

Nhầm lẫn ở đây là nguồn gốc của gần như mọi sự cố nghiêm trọng.

| Môi trường     | Địa chỉ                           | Database                                  | Ai thấy          |
| -------------- | --------------------------------- | ----------------------------------------- | ---------------- |
| **Máy local**  | `localhost:3000`                  | `fgrapher-dev`                            | Chỉ mình anh     |
| **Preview**    | Link Vercel tự sinh cho mỗi nhánh | `fgrapher-dev` (**dùng chung với local**) | Ai có link       |
| **Production** | `fgrapher.vercel.app`             | `fgrapher-prod`                           | Tất cả mọi người |

Hai điều rút ra:

- **Preview dùng chung database với máy local.** Nên dữ liệu trên preview có thể
  lộn xộn do người khác test — đó là chuyện bình thường, không phải lỗi.
- **Production có database riêng biệt.** Dữ liệu đẹp anh thấy ở máy local **không
  có** trên production. Đừng ngạc nhiên khi production trông "trống" hơn.

---

## 2. Làm sao biết website đang lỗi

### Hiện trạng thật (tính đến 12/09/2026)

**Chưa có gì tự động báo cho anh khi web lỗi.** Thư viện Sentry đã cài sẵn trong
code nhưng chưa có tài khoản Sentry để nhận. Chưa có giám sát uptime. Nghĩa là
hôm nay anh chỉ biết web hỏng khi **có người phản ánh**, hoặc khi tự vào xem.

Đây là hai việc đầu bảng trong file checklist Excel. Làm xong hai việc đó thì
mục này cần viết lại.

### Cho tới lúc đó — cách xem thủ công

1. **Nhật ký lỗi:** Vercel → chọn project → tab **Logs** → lọc `Error`.
   Đây là nơi duy nhất thấy lỗi thật đang xảy ra.
2. **Bảng điều khiển quản trị:** vào `/admin`. Xem số người dùng mới, đơn đặt
   lịch, thanh toán lỗi, báo cáo vi phạm chờ xử lý.
3. **Tự bấm thử:** mở `fgrapher.vercel.app` trên điện thoại, bấm thử trang chủ,
   tìm kiếm, một hồ sơ bất kỳ. Mất 2 phút, bắt được hầu hết lỗi nặng.

Danh sách việc cần xem hằng ngày/tuần/tháng nằm ở sheet **"Việc định kỳ"** trong
file Excel.

---

## 3. Khi người dùng báo lỗi

### Hỏi đủ 5 thứ này trước khi chuyển cho lập trình viên

Thiếu một trong năm, lập trình viên gần như chắc chắn sẽ phải hỏi lại:

1. **Anh/chị đang làm gì thì gặp lỗi?** (từng bước, không phải "web lỗi")
2. **Anh/chị mong đợi điều gì xảy ra, và thực tế xảy ra điều gì?**
3. **Ảnh chụp màn hình** — kèm cả thanh địa chỉ để biết đang ở trang nào.
4. **Dùng điện thoại hay máy tính?** Trình duyệt nào?
5. **Email tài khoản** đang đăng nhập, và **lúc mấy giờ**.

Mục 5 quan trọng nhất: có email và thời điểm thì lập trình viên lọc được đúng
dòng lỗi trong nhật ký Vercel.

### Tự kiểm tra trước: lỗi của một người hay của tất cả?

Mở trang đó bằng **cửa sổ ẩn danh** (chưa đăng nhập) và bằng **tài khoản của
anh**. Nếu chỉ tài khoản kia bị thì thường là vấn đề dữ liệu của riêng họ, không
gấp. Nếu ai cũng bị thì là sự cố thật.

---

## 4. Phân loại mức độ nghiêm trọng

Quyết định anh phải làm gì **ngay bây giờ** hay **để mai**.

| Mức           | Nghĩa là gì                                   | Ví dụ ở Fgrapher                                                                                        | Làm gì                                                     |
| ------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Nặng nhất** | Web sập, hoặc dữ liệu bị hỏng/lộ ra ngoài     | Trang chủ trắng xoá; ảnh giấy tờ tuỳ thân lộ công khai; ai cũng đăng nhập được vào tài khoản người khác | Quay lui ngay (mục 7). Không chờ tìm nguyên nhân.          |
| **Nặng**      | Một tính năng chính hỏng với nhiều người      | Không ai đặt được lịch; không gửi được email xác minh nên không ai đăng ký được                         | Báo lập trình viên ngay. Nếu vừa deploy xong thì quay lui. |
| **Vừa**       | Một tính năng phụ hỏng, hoặc chỉ vài người bị | Bộ lọc tỉnh/thành sai kết quả; một ảnh không hiện                                                       | Ghi lại, sửa trong đợt tới.                                |

Nguyên tắc: **nếu vừa deploy xong mà lỗi nặng xuất hiện, quay lui trước, điều
tra sau.** Quay lui mất 2 phút; tìm nguyên nhân có thể mất 2 giờ.

---

## 5. Quy trình sửa một lỗi

```
Nhận lỗi
   ↓
Phân loại (mục 4)
   ↓
Tạo nhánh riêng để sửa        ← KHÔNG sửa thẳng trên master
   ↓
Sửa + viết test cho đúng lỗi đó
   ↓
Chạy 4 lệnh kiểm tra (mục 6)
   ↓
Đẩy nhánh lên → Vercel tự tạo link Preview
   ↓
Anh tự bấm thử trên link Preview đó
   ↓
Gộp vào master → tự deploy production (mục 7)
   ↓
Kiểm tra lại trên production
```

**Vì sao phải có test cho đúng lỗi đó:** không có thì vài tháng sau lỗi quay lại
mà không ai biết. Một lỗi đã sửa mà không có test là một lỗi sẽ tái phát.

---

## 6. Kiểm tra trước khi đưa lên — bốn lệnh bắt buộc

Lập trình viên chạy đủ bốn lệnh này, **cả bốn đều phải sạch**, trước khi đẩy code:

| Lệnh             | Bắt lỗi gì                                                            |
| ---------------- | --------------------------------------------------------------------- |
| `pnpm lint`      | Lỗi quy ước code                                                      |
| `pnpm typecheck` | Gọi sai tên, sai kiểu dữ liệu — bắt được rất nhiều lỗi trước khi chạy |
| `pnpm test`      | Logic nghiệp vụ bị phá (hiện có 265 bài test)                         |
| `pnpm build`     | Code không đóng gói được, tức là production sẽ sập                    |

Ngoài ra, khi đẩy lên GitHub sẽ **tự chạy thêm** bộ test giao diện (Playwright)
và test so sánh hình ảnh. Xem kết quả ở GitHub → tab **Actions**.

### Phần máy không kiểm tra được — anh phải tự bấm

Máy không biết nút đặt ở chỗ khó bấm, hay chữ tiếng Việt bị vỡ. Trước mỗi đợt
deploy có thay đổi giao diện, tự đi một vòng trên link Preview:

- [ ] Trang chủ mở được, ảnh hiện đủ
- [ ] Tìm kiếm ra kết quả, bộ lọc tỉnh/thành chạy đúng
- [ ] Mở một hồ sơ, xem được ảnh portfolio, bấm phóng to ảnh
- [ ] Đặt thử một lịch tới bước cuối
- [ ] **Làm lại toàn bộ trên điện thoại** — phần lớn khách dùng điện thoại

---

## 7. Đưa lên production

### Chuyện gì tự xảy ra khi gộp code vào nhánh `master`

1. **Vercel tự deploy** lên `fgrapher.vercel.app`. Vài phút.
2. **Nếu đợt này có thay đổi cấu trúc database**, GitHub sẽ chạy workflow
   _"Migrate production"_ và **dừng lại chờ anh bấm duyệt**. Nó không tự chạy
   vào database production.

> **Anh duyệt ở đâu:** GitHub → tab **Actions** → job **Migrate production** →
> bấm nút duyệt.

### Điểm cần cẩn thận: code lên trước, database lên sau

Code mới deploy gần như tức thì, còn migration chờ anh duyệt. Trong khoảng giữa
đó, code mới đang chạy trên **database cũ** — những trang dùng tới cột mới sẽ báo
lỗi cho tới khi anh duyệt xong.

Nên: **có migration thì duyệt ngay sau khi đẩy code**, đừng để qua đêm.

### Nguyên tắc về thời điểm

- Đừng deploy **chiều thứ Sáu** hay ngay trước khi đi vắng. Hỏng thì không có ai xử lý.
- Deploy vào lúc ít người dùng nhất (sáng sớm).
- Deploy xong **ở lại theo dõi 15 phút**: mở web bấm thử, xem Vercel Logs.

---

## 8. Quay lui khi deploy hỏng

Đây là phần quan trọng nhất tài liệu này. **Có hai tình huống hoàn toàn khác nhau.**

### Tình huống A — đợt deploy KHÔNG có thay đổi database

Dễ. Quay lui trong 2 phút:

> Vercel → project → tab **Deployments** → tìm bản deploy tốt gần nhất →
> bấm **Promote to Production**.

Web trở về nguyên trạng ngay. Sau đó mới bình tĩnh tìm nguyên nhân.

### Tình huống B — đợt deploy CÓ thay đổi database

**Quay lui code KHÔNG quay lui được database.** Đây là điều dễ hiểu nhầm nhất và
là lý do mục này tồn tại.

Nếu anh vừa duyệt một migration rồi phát hiện lỗi nặng:

1. **Quay lui code trước** (như tình huống A) để chặn thiệt hại. Thường code cũ
   vẫn chạy được với database mới, vì phần lớn migration chỉ _thêm_ cột chứ
   không xoá.
2. **KHÔNG tự chạy thêm migration nào để "sửa"** khi chưa hiểu chuyện gì xảy ra.
3. **Gọi lập trình viên.** Việc sửa database hỏng phải làm theo `docs/MIGRATIONS.md`
   mục 4, không phải làm theo cảm tính.
4. Nếu dữ liệu đã hỏng (không chỉ cấu trúc), Supabase có chức năng khôi phục về
   một thời điểm trong quá khứ — **với điều kiện anh đã bật Point-in-Time
   Recovery từ trước** (đang nằm trong checklist Excel).

**Quy tắc vàng:** migration chỉ _thêm_ cột cho phép rỗng thì gần như luôn an
toàn. Migration _xoá_ cột hoặc _đổi tên_ cột là loại nguy hiểm — với loại đó,
`docs/MIGRATIONS.md` mục 3 yêu cầu chia làm ba đợt deploy tách rời, không làm
một phát.

---

## 9. Phát triển tính năng mới

Quy trình giống sửa lỗi, thêm ba điều:

### Dùng công tắc tính năng (feature flag)

Tính năng lớn nên đưa lên **ở trạng thái tắt**, bật sau bằng biến môi trường.
Ưu điểm: nếu hỏng thì **tắt đi** thay vì phải quay lui cả đợt deploy.

Dự án đang dùng cách này cho: thanh toán (`BILLING_ENABLED`, `MOMO_ENABLED`,
`ZALOPAY_ENABLED`, `BANK_TRANSFER_ENABLED`), gian hàng thiết bị
(`MARKETPLACE_ENABLED`), mạng xã hội (`SOCIAL_FEED_ENABLED`), và kiểm duyệt ảnh
tự động (`CONTENT_MODERATION_ENABLED`).

### Kiểm tra ràng buộc pháp lý trước khi làm

Trước khi làm bất cứ thứ gì đụng tới **hồ sơ người dùng, ảnh, giấy tờ tuỳ thân,
hoặc dữ liệu cá nhân**, đọc lại mục _"Ràng buộc bắt buộc"_ trong `CLAUDE.md`.
Có 10 ràng buộc, trong đó vài cái là yêu cầu pháp lý chứ không phải lựa chọn
thiết kế (ví dụ: không có danh mục nội dung nhạy cảm; mọi tài khoản từ 18 tuổi;
consent phải tách riêng từng mục đích).

### Cập nhật tài liệu cùng lúc

Đổi cấu trúc database thì cập nhật `docs/` tương ứng **trong cùng đợt**, không
để "làm sau". Tài liệu sai còn tệ hơn không có tài liệu.

---

## 10. Những việc tuyệt đối không làm

- **Không sửa code thẳng trên `master`.** Luôn tạo nhánh riêng.
- **Không chạy `pnpm db:reset` hay `pnpm db:push` khi đang trỏ vào production.**
  Hai lệnh này xoá sạch dữ liệu. Có script chặn sẵn, nhưng đừng tìm cách đi vòng.
- **Không đưa file `.env` lên GitHub.** Trong đó có mật khẩu database và khoá bí mật.
- **Không chạy `prisma/seed.ts` trên production.** Nó tạo tài khoản giả `@test.com`.
- **Không sửa trực tiếp dữ liệu trong Supabase** trừ khi thật sự biết đang làm gì.
  Mọi thao tác quản trị đều nên đi qua trang `/admin` để còn lưu nhật ký.
- **Không xoá cứng dữ liệu người dùng.** Dự án dùng xoá mềm (đánh dấu đã xoá).
  Yêu cầu xoá dữ liệu cá nhân đi theo quy trình ở `docs/OPERATIONS.md`.

---

## 11. Khi nào bắt buộc gọi lập trình viên

Đừng tự xử lý những tình huống này:

- Migration chạy lỗi giữa chừng
- Nghi ngờ dữ liệu bị lộ hoặc bị truy cập trái phép
- Cần khôi phục database từ bản sao lưu
- Web sập mà quay lui code rồi vẫn không hết
- Nhận được yêu cầu từ cơ quan chức năng về dữ liệu người dùng

---

## 12. Phần tài liệu này chưa nói được

Viết ra để sau này bổ sung, không phải để lờ đi:

- **Cảnh báo tự động:** chưa có Sentry và chưa có giám sát uptime, nên mục 2 hiện
  chỉ mô tả cách xem thủ công. Khi cài xong, mục đó cần viết lại: mỗi cảnh báo là
  gì, khi nào nó kêu, và ba việc đầu tiên cần kiểm tra khi nó kêu.
- **Ai trực:** hiện là "ai rảnh thì làm". Cần chốt người chịu trách nhiệm trước
  khi có người dùng thật phụ thuộc vào hệ thống.
- **Chế độ bảo trì:** chưa có nút bật trang "đang bảo trì". Cách nhanh nhất hiện
  nay là quay lui deploy hoặc chặn ở tầng Vercel.

---

_Cập nhật lần cuối: 12/09/2026. Khi quy trình đổi, sửa file này cùng lúc._
