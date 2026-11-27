# Đo hiệu năng 27/11/2026

Đo sau khi bản mới (commit `7660a5e`, 150 commit sau lần thử chịu tải 16/11) lên trang
chính thức. Bốn phần: tốc độ của trang chính thức, thử chịu tải trên máy, so sánh với
bản 16/11, và thời gian mở các màn hình sau đăng nhập.

Không dồn tải lên trang chính thức: ở đó chỉ có các lượt mở trang lẻ (khoảng 150 lượt
trong cả buổi). Mọi phép thử chịu tải chạy trên máy văn phòng với database
`fgrapher-dev`, giống lần 16/11 (xem `load-test-2026-11-16.md`).

## Tóm tắt

- **Máy chủ thật trả lời nhanh**: 0,2–0,3 giây cho mọi trang công khai đã đo.
- **Trên điện thoại mạng chậm, trang hiện chậm**: điểm Lighthouse 48–76/100, nội dung
  lớn nhất hiện sau 4,3–5,6 giây (mức tốt là dưới 2,5 giây). Trên mạng văn phòng, cùng
  các trang đó hiện trong 0,7–1,2 giây. Nguyên nhân nằm ở lượng dữ liệu phải tải về,
  không nằm ở máy chủ.
- **Chịu tải: không có lỗi nào** ở 10 và 50 người cùng lúc, trên cả 9 trang.
- **So với 16/11, mỗi trang nặng hơn cho máy chủ khoảng 15–25%**. Phần lớn mức chênh
  giữa con số hôm nay và con số trong báo cáo 16/11 là do máy đo hôm nay gần hết bộ nhớ.
- **Ba chỗ nên sửa trước**, xếp theo lợi ích trên công sức: ảnh đại diện tải ở kích
  thước gốc; mỗi trang gửi kèm toàn bộ bảng câu chữ của ứng dụng; chín tệp phông chữ
  được tải trước ở mọi trang.

## 1. Trang chính thức (`fgrapher.vercel.app`)

### Thời gian máy chủ trả lời

Tám lượt mỗi trang, đo từ văn phòng tại Việt Nam, đã trừ thời gian bắt tay kết nối.

| Trang                          | Trung vị | Nhanh nhất | Chậm nhất | HTML sau nén |
| ------------------------------ | -------- | ---------- | --------- | ------------ |
| Trang chủ                      | 278 ms   | 246 ms     | 3609 ms   | 101 KB       |
| Tìm kiếm F `/browse`           | 243 ms   | 215 ms     | 344 ms    | 96 KB        |
| Hồ sơ nhà cung cấp             | 287 ms   | 255 ms     | 516 ms    | 101 KB       |
| Bản đồ F                       | 221 ms   | 207 ms     | 377 ms    | 91 KB        |
| Đặt lịch F `/requests`         | 219 ms   | 203 ms     | 344 ms    | 91 KB        |
| Trang theo tỉnh                | 223 ms   | 205 ms     | 296 ms    | 92 KB        |
| Chợ F                          | 246 ms   | 241 ms     | 395 ms    | 93 KB        |
| Đăng nhập (không đọc database) | 200 ms   | 197 ms     | 301 ms    | 90 KB        |

Lượt 3,6 giây ở trang chủ là lượt đầu tiên sau một lúc không ai vào (máy chủ phải khởi
động lại). Trang có đọc database chỉ chậm hơn trang đăng nhập 20–90 ms.

### Điểm Lighthouse trên điện thoại

Lighthouse 12.8, chế độ điện thoại mặc định (mô phỏng mạng 4G chậm và bộ xử lý chậm
gấp bốn), ba lượt mỗi trang, lấy trung vị.

| Trang           | Điểm | Nội dung đầu tiên | Nội dung lớn nhất | Thời gian bị treo | Xô lệch bố cục | Tổng tải về |
| --------------- | ---- | ----------------- | ----------------- | ----------------- | -------------- | ----------- |
| Trang chủ       | 68   | 1,7 s             | 5,6 s             | 548 ms            | 0              | 1105 KB     |
| Tìm kiếm F      | 75   | 1,7 s             | 5,0 s             | 306 ms            | 0              | 761 KB      |
| Hồ sơ           | 64   | 1,7 s             | 5,5 s             | 481 ms            | 0              | 2140 KB     |
| Bản đồ F        | 48   | 1,8 s             | 4,8 s             | 3458 ms           | 0,02           | 1822 KB     |
| Đặt lịch F      | 76   | 1,7 s             | 4,3 s             | 386 ms            | 0              | 670 KB      |
| Trang theo tỉnh | 69   | 1,7 s             | 4,3 s             | 554 ms            | 0              | 1875 KB     |
| Đăng nhập       | 67   | 1,6 s             | 4,3 s             | 707 ms            | 0              | 676 KB      |

Mốc thường dùng: nội dung lớn nhất dưới 2,5 giây là tốt, trên 4 giây là kém; thời gian
bị treo dưới 200 ms là tốt. Bố cục không xô lệch ở trang nào.

### Trình duyệt thật, màn hình điện thoại

Mở trang chính thức như một khách lần đầu vào, đo thời điểm trình duyệt báo vẽ xong.

| Trang     | Mạng văn phòng: nội dung lớn nhất | Mạng 4G chậm + máy chậm gấp bốn: HTML về đủ / nội dung đầu / nội dung lớn nhất |
| --------- | --------------------------------- | ------------------------------------------------------------------------------ |
| Trang chủ | 0,9 s                             | 3,8 s / 4,0 s / 6,1 s                                                          |
| Hồ sơ     | 1,2 s                             | 3,7 s / 4,7 s / 4,7 s                                                          |
| Đăng nhập | 0,7 s                             | 3,2 s / 3,6 s / 3,9 s                                                          |

Trên mạng chậm, riêng tệp HTML mất 3,2–3,8 giây mới về đủ dù máy chủ gửi byte đầu sau
0,2 giây: nó phải chia đường truyền với phông chữ, CSS và mã JavaScript cùng tải. Ở
trang chủ, Đặt lịch F, Bản đồ F và Đăng nhập, phần tử lớn nhất trên màn hình lần đầu
vào là đoạn chữ của khung thông báo cookie, nằm cuối tệp HTML nên được vẽ sau cùng.

Mỗi lượt tải trang công khai gồm: mã JavaScript 375–440 KB (874 KB ở Bản đồ F), phông
chữ 167–186 KB trong 8–9 tệp, HTML 87–97 KB, CSS 32 KB, còn lại là ảnh.

## 2. Thử chịu tải trên máy (bản hiện tại)

Bản build production chạy `next start` (một tiến trình Node) trên máy văn phòng, nối
`fgrapher-dev`. autocannon 8.0.0, 20 giây mỗi mức.

| Trang                 | 10 người: trang/giây, trung vị, 97,5% | 50 người: trang/giây, trung vị, 97,5% | Lỗi |
| --------------------- | ------------------------------------- | ------------------------------------- | --- |
| Trang chủ             | 14 · 658 ms · 1165 ms                 | 12 · 4001 ms · 5983 ms                | 0   |
| Tìm kiếm F            | 15 · 641 ms · 1099 ms                 | 15 · 2811 ms · 4553 ms                | 0   |
| Hồ sơ nhiếp ảnh gia   | 12 · 870 ms · 1197 ms                 | 11 · 3605 ms · 5568 ms                | 0   |
| Hồ sơ studio          | 9 · 1030 ms · 1684 ms                 | 9 · 4640 ms · 8577 ms                 | 0   |
| Hồ sơ shop trang phục | 11 · 893 ms · 1341 ms                 | 12 · 3574 ms · 5791 ms                | 0   |
| Bản đồ F              | 22 · 407 ms · 842 ms                  | 22 · 2088 ms · 3835 ms                | 0   |
| Đặt lịch F            | 20 · 471 ms · 851 ms                  | 21 · 2297 ms · 3388 ms                | 0   |
| Trang theo tỉnh       | 22 · 378 ms · 763 ms                  | 19 · 2562 ms · 3216 ms                | 0   |
| Chợ F                 | 17 · 545 ms · 866 ms                  | 18 · 2659 ms · 3025 ms                | 0   |

Không có lỗi, timeout hay mã khác 2xx ở lượt nào.

**Đừng so thẳng các con số này với bảng 16/11 (khoảng 40 trang/giây).** Trong lúc đo,
máy chỉ còn trống 0,4–1,5 GB trên 16 GB bộ nhớ vì các ứng dụng khác đang mở và phải
đọc ghi bộ nhớ ảo liên tục. Chính bản 16/11 khi đo lại hôm nay cũng chỉ đạt 10–27
trang/giây (mục 3).

## 3. So với bản 16/11, đo xen kẽ trên cùng máy

Dựng lại commit `fb4c3ef` (16/11) trong một thư mục tạm, chạy song song trên cổng khác,
đo xen kẽ mới, cũ, cũ, mới (12 giây mỗi lượt) để mọi thứ khác đang chạy trên máy ảnh
hưởng đều lên cả hai.

| Trang               | 10 người: cũ → mới (trang/giây) | 50 người: cũ → mới (trang/giây) | HTML chưa nén: cũ → mới |
| ------------------- | ------------------------------- | ------------------------------- | ----------------------- |
| Trang chủ           | 15 → 11                         | 10 → 6                          | 437 → 526 KB            |
| Tìm kiếm F          | 22 → 9                          | 19 → 16                         | 358 → 427 KB            |
| Hồ sơ nhiếp ảnh gia | 21 → 16                         | 16 → 12                         | 372 → 447 KB            |
| Bản đồ F            | 27 → 21                         | 25 → 17                         | 282 → 359 KB            |

Bản mới thấp hơn ở cả 8 cặp. Các lượt dao động mạnh (cùng một bản, hai lượt liền nhau
có thể lệch gấp đôi), nên mức chênh từng dòng không đáng tin; hướng thì nhất quán.

Phép đo sạch nhất là từng yêu cầu một trên trang đăng nhập, trang không đọc database:
**30 ms mỗi trang ở bản cũ, 35 ms ở bản mới (+17%)**, ổn định qua ba lượt. Mức tăng này
khớp với bảng câu chữ `vi.json` lớn lên từ 262 KB thành 343 KB (+31%): bảng này được
gửi kèm nguyên vẹn trong mọi trang, nên mỗi trang nặng thêm khoảng 80 KB. Suy từ hai
điểm đo đó, việc đóng gói bảng câu chữ chiếm ước chừng hơn một nửa thời gian máy chủ
dựng một trang nhẹ. Đây là ước tính, chưa đo trực tiếp.

## 4. Database `fgrapher-dev`

Cùng cách đo với 16/11: nhiều PrismaClient, truy vấn kiểu Tìm kiếm F, 10 giây mỗi mức,
chạy hai lần cách nhau một phút.

| Truy vấn song song | Truy vấn/giây (hai lần) | Trung vị (hai lần) | 16/11        | Lỗi |
| ------------------ | ----------------------- | ------------------ | ------------ | --- |
| 10                 | 43 và 32                | 219 và 304 ms      | 45 · 214 ms  | 0   |
| 30                 | 86 và 63                | 343 và 469 ms      | 147 · 200 ms | 0   |
| 60                 | 77 và 57                | 823 và 1142 ms     | 136 · 443 ms | 0   |

Một truy vấn đơn (`SELECT 1`) mất 205 ms ở lần đầu và 291 ms ở lần sau: đường truyền
từ văn phòng sang Singapore hôm nay dao động 40% trong vài phút. Ở 30 và 60 truy vấn
song song, thông lượng chỉ bằng khoảng một nửa lần 16/11. Dáng số liệu giống hàng chờ
ở khoảng 15 kết nối cùng lúc. Từ đây không phân biệt được ba khả năng: cài đặt pool của
database dev, tải khác trên database dev lúc đo, hay đường truyền. Truy vấn mẫu cũng
không giống hệt lần trước (script cũ không còn), nên chỉ so được về cỡ.

## 5. Màn hình sau đăng nhập

Bản build trên máy, màn hình 390×844, ba lượt mỗi màn hình, lấy trung vị thời gian chờ
máy chủ. Tài khoản thử `fgw33` trên database dev.

| Vai trò         | Số màn hình | Chờ máy chủ | Chậm nhất                              |
| --------------- | ----------- | ----------- | -------------------------------------- |
| Chưa đăng nhập  | 9           | 0,04–0,98 s | Hồ sơ studio 0,98 s; Chợ F 0,69 s      |
| Khách hàng      | 10          | 0,48–0,96 s | Cài đặt 0,96 s; Bảng điều khiển 0,90 s |
| Nhiếp ảnh gia   | 13          | 0,91–1,43 s | Đánh giá 1,43 s; Cơ hội 1,34 s         |
| Studio          | 3           | 0,96–1,09 s | Sửa hồ sơ 1,09 s                       |
| Shop trang phục | 3           | 0,94–1,03 s | Tin nhắn 1,03 s                        |
| Shop thiết bị   | 3           | 0,99–1,05 s | Tin đăng 1,05 s                        |
| Quản trị        | 9           | 1,28–1,69 s | Thanh toán 1,69 s; Tuân thủ 1,67 s     |

**Các con số này bị khoảng cách văn phòng–Singapore thổi lên**: từ máy này mỗi lần hỏi
database mất 0,2–0,3 giây. Trên trang chính thức, máy chủ nằm cùng vùng với database;
các trang công khai có đọc database ở đó chỉ chậm hơn trang đăng nhập 20–90 ms, trong
khi trên máy này chậm hơn 300–360 ms. Theo tỷ lệ đó, **ước tính** trên trang chính
thức: 0,35–0,55 giây cho màn hình sau đăng nhập, 0,4–0,6 giây cho trang quản trị. Chưa
đo được trực tiếp vì không có tài khoản trên trang chính thức.

Điều đo được chắc chắn là thứ tự và nguyên nhân:

- Mỗi màn hình sau đăng nhập hỏi database 4–6 lần **nối tiếp nhau** trước khi trả
  trang (suy từ thời gian chờ chia cho thời gian một lần hỏi). Hai lần đầu giống nhau ở
  mọi màn hình và nằm trong `(dashboard)/layout.tsx`: kiểm tra tài khoản có bị khóa hay
  xóa không, rồi hỏi "có điểm chụp công khai nào không" (`hasPublicPlaces`). Lần sau
  chờ lần trước xong mới chạy, và trang chỉ bắt đầu đọc dữ liệu của mình sau cả hai.
- Màn hình **Chi tiết lịch đặt** nhận trang xong mới gửi yêu cầu thứ hai để lấy lịch
  đặt, nên nội dung hiện sau trang khoảng 1,4 giây (trên máy này). Cùng kiểu: Tin đăng
  và Đơn của shop, và ba trang quản trị Người dùng, Báo cáo, Tuân thủ.
- Mọi màn hình sau đăng nhập gửi thêm ba yêu cầu nền (giỏ hàng, tin nhắn chưa đọc, số
  thông báo), mỗi cái là một lượt gọi máy chủ riêng.
- Hồ sơ studio công khai chậm hơn hồ sơ nhiếp ảnh gia khoảng hai lần hỏi database.

## 6. Nên sửa, theo thứ tự

Mục 1–4 đã được sửa trong ngày 27/11; số đo trước và sau nằm ở mục 8. Mục 5–7 được
sửa sau đó cùng ngày; số đo ở mục 9.

1. **Ảnh đại diện tải ở kích thước gốc.** `AvatarImage` (23 chỗ dùng) đưa thẳng địa chỉ
   ảnh đã lưu, không qua hàm thu nhỏ có sẵn trong `lib/media/variants.ts`. Trên hồ sơ
   thật đang có, một ảnh PNG 1,18 MB được tải về để hiện trong vòng tròn nhỏ; đó là hơn
   nửa dung lượng trang hồ sơ (2140 KB). Địa chỉ ảnh gốc đó cũng nằm trong dữ liệu của
   trang theo tỉnh (1875 KB), nhiều khả năng vì cùng lý do. Sửa một chỗ.
2. **Bảng câu chữ gửi nguyên vẹn ở mọi trang.** `app/layout.tsx` đưa cả `vi.json` (343
   KB, 71–77 KB sau nén) cho trình duyệt, tức khoảng ba phần tư tệp HTML của mỗi trang,
   kể cả câu chữ của trang quản trị gửi cho khách vãng lai. Chia theo khu vực (công
   khai, sau đăng nhập, quản trị) ở mức thô đã bỏ được khoảng 40 KB sau nén cho trang
   công khai (các nhóm câu chữ công khai nặng 36 KB so với 77 KB của cả bảng); chia kỹ
   hơn thì bỏ được nhiều hơn. Máy chủ cũng dựng mỗi trang nhẹ hơn. Bảng này lớn thêm
   theo mỗi tính năng mới.
3. **Phông chữ.** 8–9 tệp phông (167–186 KB) được tải trước ở mọi trang, tranh đường
   truyền với HTML và CSS. Chỉ tải trước những tệp cần cho màn hình đầu.
4. **Màn hình sau đăng nhập.** Cho hai lần hỏi database trong layout chạy song song
   (hoặc nhớ tạm câu trả lời về điểm chụp, vì nó hiếm khi đổi), để trang đọc dữ liệu
   của mình cùng lúc, và gộp ba yêu cầu nền thành một.
5. **Chi tiết lịch đặt và các danh sách lấy dữ liệu bằng yêu cầu thứ hai.** Dựng luôn
   trên máy chủ trong lượt đầu.
6. **Bản đồ F.** Điểm 48; bộ máy bản đồ làm điện thoại treo khoảng 3,5 giây. Cho bản đồ
   khởi động sau khi phần còn lại của trang đã hiện.
7. **Mã JavaScript 375–440 KB ở trang công khai.** Việc dài hơi hơn các mục trên.

## 7. Chưa đo và giới hạn

- Chưa thử chịu tải trên trang chính thức (cố ý: nó dồn tải lên database thật).
- Chưa đo màn hình sau đăng nhập trên trang chính thức (không có tài khoản ở đó).
- Chưa đo trên điện thoại thật hay Safari; chưa có số liệu người dùng thật vì chưa có
  người dùng.
- Máy đo gần hết bộ nhớ suốt buổi. Các con số phụ thuộc bộ xử lý (trang/giây, thời gian
  bị treo khi ép chậm thật) vì thế xấu hơn thực tế; các con số phụ thuộc đường truyền
  và dung lượng thì không bị ảnh hưởng.
- Chưa kiểm tra cài đặt pool kết nối của Supabase cho dev và production.

## 8. Sau khi sửa mục 1–4 (đo lại 27/11)

Hai bản build production chạy cạnh nhau trên máy văn phòng, cùng nối `fgrapher-dev`:
"trước" là commit `03e6528` trong một thư mục tạm, "sau" là mã đã sửa. Các lượt đo
xen kẽ nhau. Chưa bản nào trong hai bản này ở trên trang chính thức.

### Đã sửa gì

1. **Ảnh đại diện**: `AvatarImage` xin ảnh rộng 256 px (400 px ở hai chỗ hiện lớn)
   qua `buildAvatarUrl`. Ảnh trên hồ sơ thật đang có: 1.208 KB còn 5 KB và 9 KB.
2. **Bảng câu chữ**: trình duyệt chỉ nhận các nhóm mà mã chạy trên trình duyệt của
   khu vực đó dùng. Layout gốc gửi 4 KB; từng khu vực gửi thêm phần của mình: công
   khai 80 KB, sau đăng nhập 85 KB, quản trị 23 KB, đăng nhập và đăng ký 9 KB, luồng
   đặt lịch 14 KB, onboarding 7 KB (trước: 285 KB ở mọi trang). Danh sách do
   `scripts/gen-client-message-scopes.mjs` sinh từ mã nguồn; xem `docs/DEVELOPMENT.md`
   mục 8.
3. **Phông chữ**: phông mono không còn được tải trước; số tệp phông tải trước ở mỗi
   trang từ 7 còn 4.
4. **Màn hình sau đăng nhập**: layout hỏi hai câu cùng lúc; lần tra cứu tài khoản và
   quyền quản trị chỉ chạy một lần cho mỗi trang (trước đây layout và trang mỗi bên
   hỏi một lần); ba số trên thanh đầu trang đến từ một yêu cầu
   `/api/users/me/badges`, và giỏ hàng chỉ được tải khi mở ngăn giỏ hàng.

### Dung lượng tệp HTML (chưa nén / đã nén, KB)

| Trang               | Trước     | Sau      |
| ------------------- | --------- | -------- |
| Trang chủ           | 523 / 107 | 309 / 56 |
| Tìm kiếm F          | 424 / 98  | 210 / 46 |
| Hồ sơ nhiếp ảnh gia | 444 / 101 | 230 / 50 |
| Hồ sơ studio        | 438 / 100 | 223 / 48 |
| Bản đồ F            | 356 / 89  | 142 / 38 |
| Đặt lịch F          | 356 / 90  | 142 / 38 |
| Trang theo tỉnh     | 386 / 93  | 171 / 41 |
| Chợ F               | 384 / 94  | 169 / 42 |
| Đăng nhập           | 356 / 90  | 63 / 14  |

Màn hình sau đăng nhập (đã nén): 90–96 KB còn 39–46 KB; trang quản trị 88–92 KB còn
18–23 KB.

### Công máy chủ cho mỗi trang

Trang đăng nhập (không đọc database), từng yêu cầu một, ba lượt xen kẽ mỗi bản:
**47 ms còn 24 ms**. Ở các trang công khai có đọc database, thời gian chờ máy chủ
không đổi (chênh trong khoảng 10–25 ms, cùng cỡ với mức chênh 11 ms giữa hai tiến
trình khi chạy một đoạn mã giống hệt nhau): ở đó thời gian chờ database lấn át.

Chịu tải, 12 giây × 2 lượt xen kẽ, trang/giây trước → sau: Trang chủ 12 → 16 (10
người) và 11 → 10 (50 người); Tìm kiếm F 17 → 13 và 15 → 20; Hồ sơ 12 → 15 và 11 →
12; Bản đồ F 19 → 23 và 15 → 23. Bản sau cao hơn ở 6 trên 8 cặp, không có lỗi; các
lượt vẫn dao động mạnh vì máy thiếu bộ nhớ, nên chỉ nên đọc hướng, không đọc độ lớn.

### Màn hình sau đăng nhập

Trung vị ba lượt xen kẽ mỗi bản, màn hình 390×844. Thời gian chờ máy chủ ở đây vẫn bị
khoảng cách tới Singapore thổi lên như ở mục 5; trên trang chính thức mức giảm tuyệt
đối sẽ nhỏ hơn nhiều.

| Vai trò, màn hình              | Chờ máy chủ trước → sau | Yêu cầu nền sau khi tải |
| ------------------------------ | ----------------------- | ----------------------- |
| Khách hàng, Bảng điều khiển    | 991 → 749 ms            | 3 → 1                   |
| Khách hàng, Lịch đặt           | 1023 → 675 ms           | 3 → 1                   |
| Khách hàng, Chi tiết lịch đặt  | 1303 → 968 ms           | 4 → 2                   |
| Khách hàng, Tin nhắn           | 1326 → 1076 ms          | 3 → 1                   |
| Nhiếp ảnh gia, Bảng điều khiển | 1036 → 888 ms           | 3 → 1                   |
| Nhiếp ảnh gia, Gói dịch vụ     | 955 → 650 ms            | 3 → 1                   |
| Nhiếp ảnh gia, Đánh giá        | 1254 → 1033 ms          | 3 → 1                   |
| Nhiếp ảnh gia, Portfolio       | 1526 → 1004 ms          | 3 → 1                   |
| Quản trị, Tổng quan            | 1272 → 921 ms           | 1 → 1                   |
| Quản trị, Người dùng           | 1391 → 1108 ms          | 2 → 2                   |
| Quản trị, Duyệt giấy tờ        | 1646 → 1409 ms          | 2 → 2                   |
| Quản trị, Thanh toán           | 1628 → 1384 ms          | 2 → 2                   |

### Lighthouse trên điện thoại (bản chạy tại máy)

Ba lượt mỗi trang mỗi bản, thêm hai lượt xen kẽ cho trang chủ. Các con số tuyệt đối
cao hơn mục 1 vì máy chủ tại máy phải chờ database ở xa.

| Trang     | Nội dung đầu tiên | Nội dung lớn nhất | Tổng tải về    |
| --------- | ----------------- | ----------------- | -------------- |
| Trang chủ | 2,0 → 1,7 s       | 7,1 → 6,4–6,7 s   | 1561 → 1479 KB |
| Hồ sơ     | 2,5 → 2,4 s       | 7,1 → 6,6 s       | 2267 → 2141 KB |
| Đăng nhập | 1,5 → 1,2 s       | 5,7 → 5,2 s       | 711 → 606 KB   |

Điểm tổng và thời gian bị treo không so được: cùng một bản, cùng một trang, thời gian
bị treo đo được từ 124 đến 1218 ms tùy lượt. **Nội dung lớn nhất vẫn hiện sau hơn 4
giây trong điều kiện mô phỏng**; phần còn lại là mã JavaScript (mục 7), chưa động tới.

### Kiểm tra không làm hỏng gì

- Mở 254 màn hình trên bản build bằng 10 loại tài khoản (khách chưa đăng nhập, khách
  hàng, bốn loại nhà cung cấp, studio, shop trang phục, shop thiết bị, quản trị), mở
  cả chuông, giỏ hàng, hộp tin nhắn và menu: không màn hình nào hiện tên khóa thay cho
  câu chữ, không có báo thiếu câu chữ ở trình duyệt hay ở máy chủ, không có lỗi 5xx.
- Chuông thông báo, ngăn giỏ hàng (thêm một món rồi lấy ra) và ảnh đại diện: 16 kiểm
  tra đều đạt. Số của `/api/users/me/badges` khớp ba endpoint cũ; chưa đăng nhập thì
  nhận 401.
- `pnpm typecheck` sạch, `pnpm lint` 0 lỗi, `pnpm test` 840/840.

## 9. Sau khi sửa mục 5–7 (đo lại 27/11)

Cùng cách với mục 8: hai bản build chạy cạnh nhau, "trước" là commit `3ae6402` (đã
có bốn sửa đổi của mục 8), "sau" là mã đã sửa thêm. Chưa bản nào ở trên trang chính
thức.

### Đã sửa gì

5. **Dữ liệu đến cùng trang.** Chi tiết lịch đặt và ba trang quản trị (Người dùng,
   Báo cáo, Tuân thủ) đọc dữ liệu cho lần hiện đầu ngay trên máy chủ, bằng đúng cổng
   kiểm tra và đúng hàm đọc của API tương ứng. Trang Đơn của shop không đổi: Chợ F
   đang tắt ngoài phạm vi MVP. Trang Tin đăng vốn đã dựng trên máy chủ.
6. **Bản đồ F** khởi động bộ máy bản đồ sau khi phần còn lại của trang đã hiện và
   trình duyệt rảnh.
7. **Mã tải với trang.** Phân tích bằng `next analyze` cho trang chủ: khung Next và
   React 205 KB (nén), thư viện giao diện base-ui 97 KB, bộ báo lỗi Sentry 76 KB,
   mã của ứng dụng khoảng 45 KB. Đã tách khỏi lượt tải đầu: Sentry (nạp khi trang
   rảnh, không nạp nếu không có DSN), hộp tin nhắn, chuông và ngăn giỏ hàng (chỉ
   người đã đăng nhập mới tải).

Thêm hai sửa đổi nhằm đúng vào con số "nội dung lớn nhất hiện chậm" của mục 8:
ảnh chính của trang được tải với mức ưu tiên cao (`priority` của next/image từ Next
16 chỉ còn thêm thẻ preload, không còn đặt mức ưu tiên), và khung cookie được đặt
trước nội dung trang trong tệp HTML.

### Mã JavaScript trình duyệt tải về (KB đã nén, bộ nhớ đệm trống)

| Trang                      | Trước khi trang tải xong: trước → sau | Tải thêm sau đó: trước → sau |
| -------------------------- | ------------------------------------- | ---------------------------- |
| Trang chủ                  | 416 → 319                             | 0 → 77                       |
| Tìm kiếm F                 | 400 → 306                             | 0 → 77                       |
| Hồ sơ nhiếp ảnh gia        | 453 → 365                             | 274 → 351                    |
| Đăng nhập                  | 428 → 288                             | 0 → 77                       |
| Bản đồ F                   | 456 → 359                             | 277 → 354                    |
| Bảng điều khiển khách hàng | 394 → 304                             | 0 → 111                      |
| Quản trị, Người dùng       | 373 → 241                             | 29 → 175                     |

77 KB tải thêm là Sentry, vì máy đo có đặt DSN; không có DSN thì không tải. Với
người đã đăng nhập, tổng lượng mã tải về tăng khoảng 20–35 KB do chia thành nhiều
tệp hơn, nhưng phần tải trước khi trang dùng được giảm 90–130 KB.

### Màn hình có dữ liệu ngay

| Màn hình                      | Nội dung hiện sau: trước → sau | Yêu cầu sau khi tải |
| ----------------------------- | ------------------------------ | ------------------- |
| Khách hàng, Chi tiết lịch đặt | 3140 → 2022 ms                 | 2 → 1               |
| Quản trị, Người dùng          | 2845 → 1443 ms                 | 2 → 1               |
| Quản trị, Báo cáo             | 3948 → 2268 ms (theo LCP)      | 2 → 1               |

Thời gian chờ máy chủ của trang Báo cáo tăng (1426 → 2065 ms) vì máy chủ giờ đọc
danh sách trước khi trả trang; tổng thời gian đến lúc thấy danh sách vẫn ngắn hơn.

### Điện thoại chậm, đo bằng trình duyệt bị ép chậm thật

Trình duyệt bị giới hạn ở mạng 4G chậm và bộ xử lý chậm gấp bốn (không phải mô
phỏng của Lighthouse), hai lượt xen kẽ mỗi bản, màn hình 390×844.

| Trang     | Nội dung đầu tiên | Nội dung lớn nhất | Thời gian bị treo sau đó | Trang tải xong |
| --------- | ----------------- | ----------------- | ------------------------ | -------------- |
| Trang chủ | 2,4 → 2,5 s       | 2,8 → 2,6 s       | 4,9 → 4,6 s              | 9,9 → 7,7 s    |
| Đăng nhập | 1,5 → 1,5 s       | 1,5 → 1,5 s       | 3,7 → 1,6 s              | 6,0 → 2,8 s    |
| Hồ sơ     | 1,8 → 1,7 s       | 2,1 → 1,7 s       | 8,3 → 7,2 s              | 7,0 → 5,1 s    |
| Bản đồ F  | 1,6 → 1,6 s       | 1,8 → 1,7 s       | 9,4 → 6,5 s              | 7,1 → 3,3 s    |

Thời gian bị treo là phần vượt quá 50 ms của mỗi lần luồng chính bận, cộng lại
trong khoảng 12 giây sau lần vẽ đầu. Nó vẫn lớn: chạy mã JavaScript của trang trên
máy chậm là phần nặng nhất còn lại, và máy đo thiếu bộ nhớ làm con số này xấu thêm.

### Lighthouse (mô phỏng), ba lượt xen kẽ mỗi bản

| Trang     | Nội dung lớn nhất | Nội dung đầu tiên | Thời gian bị treo | Mã tải về    |
| --------- | ----------------- | ----------------- | ----------------- | ------------ |
| Trang chủ | 6,8 → 5,5 s       | 1,7 → 1,7 s       | 618 → 769 ms      | 416 → 396 KB |
| Đăng nhập | 5,3 → 4,2 s       | 1,2 → 1,2 s       | 1018 → 167 ms     | 428 → 366 KB |
| Hồ sơ     | 6,7 → 5,8 s       | 1,7 → 2,2 s       | 4633 → 5332 ms    | 874 → 864 KB |
| Bản đồ F  | 5,8 → 4,9 s       | 1,4 → 1,4 s       | 4399 → 5832 ms    | 880 → 860 KB |

**Hai cách đo không khớp nhau, và nên tin cách đo thật hơn.** Mô phỏng của
Lighthouse tính mọi tệp mã đã tải xong trước lần vẽ, trong một lượt tải nhanh
không ép, là thứ chặn lần vẽ đó; vì vậy nó báo nội dung lớn nhất sau 5–7 giây trong
khi trình duyệt bị ép chậm thật vẽ nó sau 1,5–2,8 giây. Cũng vì cách tính đó, việc
dời Sentry và bản đồ ra sau lần vẽ đầu làm "thời gian bị treo" mô phỏng tăng ở hai
trang có bản đồ, trong khi đo thật thì giảm. Con số Lighthouse vẫn đáng ghi lại vì
đó là thứ các công cụ bên ngoài sẽ báo.

### Kiểm tra không làm hỏng gì

- Mở lại 254 màn hình bằng 10 loại tài khoản: không có tên khóa thay cho câu chữ,
  không có báo lỗi hydrat hóa hay thiếu tệp mã, không có lỗi 5xx; nhật ký máy chủ
  sạch.
- 37 kiểm tra chức năng đều đạt: chi tiết lịch đặt có sẵn trong HTML và trình duyệt
  không gọi lại API; ba trang quản trị có sẵn danh sách, bộ lọc vẫn gọi máy chủ;
  chuông, giỏ hàng, hộp tin nhắn vẫn mở được; khung cookie hiện, trả lời được, nhớ
  câu trả lời, và nút của nó nằm trên thanh điều hướng của điện thoại.
- Quyền riêng tư của chi tiết lịch đặt: với một lịch đang chờ và một lịch đã bị từ
  chối, trang gửi cho nhà cung cấp không chứa số điện thoại hay địa chỉ của khách
  (API cũ cũng vậy); khách vẫn thấy số của mình; sau khi nhận lời thì nhà cung cấp
  thấy. Tài khoản không liên quan nhận màn hình "không tìm thấy" và HTML không có
  chi tiết nào; người chưa đăng nhập bị chuyển hướng; tài khoản thường mở trang
  quản trị nhận 404 và không có danh sách.
- `pnpm typecheck` sạch, `pnpm lint` 0 lỗi, `pnpm test` đạt toàn bộ.

### Còn lại

- Thời gian luồng chính bị treo trên máy chậm (4,6–7,2 giây ở các phép đo trên).
  Muốn giảm nữa phải bớt mã chạy khi mở trang: base-ui 97 KB và khung Next, React
  205 KB là hai phần lớn nhất; ô tìm kiếm ở trang chủ kéo theo combobox và select.
- Kiểu bản đồ của Bản đồ F (OpenFreeMap "liberty") nhiều lớp; đổi sang kiểu nhẹ hơn
  là quyết định về giao diện, chưa làm.

## Đo lại

- Dựng: `pnpm build`, chạy `AUTH_TRUST_HOST=true pnpm start`. Thiếu biến này thì đăng
  nhập trên bản build tại máy báo lỗi `UntrustedHost`. Đo xong xóa `.next`.
- Muốn biết mã có chậm đi không, dựng thêm commit cũ bằng `git worktree` rồi đo xen kẽ
  hai bản; đừng so với con số của một ngày khác.
- Công cụ: autocannon 8.0.0 cho tải, Lighthouse 12 cho điểm điện thoại, Playwright cho
  thời gian từng màn hình. Các script dùng hôm nay là tệp tạm, không nằm trong repo.
