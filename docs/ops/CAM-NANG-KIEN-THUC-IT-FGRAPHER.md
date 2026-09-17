# Cẩm nang kiến thức IT để hiểu dự án Fgrapher

## Cách dùng tài liệu này

Tài liệu này dành cho chủ dự án hoặc người mới học lập trình. Mục tiêu không phải
biến bạn thành lập trình viên trong một lần đọc, mà giúp bạn:

- hiểu các thành phần của Fgrapher đang làm gì;
- đọc trao đổi kỹ thuật mà không bị ngợp bởi thuật ngữ;
- biết câu hỏi nào nên đặt ra khi duyệt một thay đổi;
- phân biệt lỗi giao diện, lỗi nghiệp vụ, lỗi database và lỗi hạ tầng;
- tự học theo đúng thứ tự thay vì nhảy ngẫu nhiên giữa hàng trăm khái niệm.

Tên file, hàm, biến và công nghệ được giữ nguyên để bạn có thể tìm chúng trong
repo. Mỗi thuật ngữ được giải thích bằng ví dụ của chính Fgrapher.

---

## 1. Bức tranh toàn cảnh

Fgrapher là một **web application**: người dùng mở giao diện trong trình duyệt,
trình duyệt gọi máy chủ, máy chủ xử lý quy tắc và đọc/ghi database.

```text
Người dùng
   ↓ thao tác trên trình duyệt
React + Next.js giao diện
   ↓ HTTP request tới API
Route Handler kiểm tra đăng nhập và dữ liệu đầu vào
   ↓ gọi service nghiệp vụ
Service áp dụng quy tắc đặt lịch/thanh toán/thông báo
   ↓ Prisma tạo câu lệnh SQL
PostgreSQL lưu dữ liệu lâu dài

Các dịch vụ bên ngoài:
Cloudinary lưu ảnh/video · Resend gửi email · Vercel chạy web
Supabase cung cấp PostgreSQL · Sentry nhận lỗi · Google hỗ trợ OAuth
```

Một nguyên tắc quan trọng: giao diện không phải nơi quyết định cuối cùng. Người
dùng có thể sửa request bằng công cụ riêng, nên quyền truy cập và dữ liệu phải
được kiểm tra lại trên server.

---

## 2. Những công nghệ chính

| Công nghệ             | Vai trò trong Fgrapher                 | Cách hiểu đơn giản                                          |
| --------------------- | -------------------------------------- | ----------------------------------------------------------- |
| TypeScript            | Ngôn ngữ chính                         | JavaScript có hệ thống kiểm tra kiểu dữ liệu                |
| React 19              | Xây giao diện từ component             | Chia màn hình thành các khối có thể tái sử dụng             |
| Next.js 16 App Router | Framework web                          | Tổ chức trang, API, render server và build                  |
| Node.js               | Môi trường chạy JavaScript phía server | Nơi code backend thực thi                                   |
| PostgreSQL            | Database quan hệ                       | Kho dữ liệu có bảng, quan hệ và transaction                 |
| Supabase              | Nơi vận hành PostgreSQL                | Dịch vụ quản lý database cho dự án                          |
| Prisma ORM            | Lớp làm việc với database              | Viết query bằng TypeScript thay vì SQL thuần                |
| Tailwind CSS 4        | Tạo kiểu giao diện                     | Ghép class nhỏ trực tiếp trong component                    |
| shadcn/ui, Base UI    | Component nền                          | Button, dialog, menu có accessibility cơ bản                |
| NextAuth v5           | Đăng nhập và session                   | Credentials + Google OAuth                                  |
| Zod                   | Kiểm tra dữ liệu đầu vào               | Từ chối dữ liệu sai trước khi xử lý                         |
| react-hook-form       | Quản lý form                           | Theo dõi field, lỗi và trạng thái gửi                       |
| next-intl             | Đa ngôn ngữ                            | Đọc chuỗi từ `vi.json`/`en.json`                            |
| Cloudinary            | Lưu và biến đổi media                  | Ảnh, video, thumbnail, URL có chữ ký                        |
| Resend                | Gửi email                              | Nhận email từ app và giao cho hộp thư                       |
| Vercel                | Deploy và chạy Next.js                 | Production, Preview, Logs, Cron                             |
| Sentry                | Theo dõi lỗi                           | Thu lỗi runtime để điều tra; cần cấu hình tài khoản         |
| Playwright            | Test trình duyệt                       | Mô phỏng người dùng bấm thật trên web                       |
| ESLint, Prettier      | Chất lượng code                        | Phát hiện mẫu nguy hiểm và định dạng thống nhất             |
| Twilio Verify         | Gửi mã xác minh số điện thoại          | Dịch vụ SMS bên ngoài; mỗi lần gửi có thể phát sinh chi phí |
| dnd-kit               | Kéo thả và sắp xếp                     | Đổi thứ tự album, ảnh hoặc sản phẩm bằng chuột/cảm ứng      |
| react-dropzone        | Chọn và thả file để tải lên            | Nhận file từ máy người dùng trước khi upload                |
| react-easy-crop       | Cắt ảnh                                | Cho người dùng chọn phần ảnh muốn giữ                       |
| qrcode                | Tạo mã QR hồ sơ                        | Biến URL hồ sơ thành hình có thể quét                       |
| date-fns              | Xử lý ngày giờ                         | Tính, so sánh và định dạng ngày theo locale                 |
| next-themes           | Chế độ sáng/tối                        | Đồng bộ theme và lựa chọn của người dùng                    |

Phiên bản cụ thể nằm trong `package.json`. Không nên học theo hướng dẫn của phiên
bản cũ khi sửa Next.js, React hoặc NextAuth vì API có thể đã thay đổi.

---

## 3. Cấu trúc repo

```text
src/app/            trang và API theo Next.js App Router
src/components/     các mảnh giao diện dùng lại
src/services/       quy tắc nghiệp vụ chạy trên server
src/lib/            công cụ chung, auth, email, cache, validation
src/hooks/          logic React dùng lại ở client
src/messages/       bản dịch tiếng Việt và tiếng Anh
prisma/             schema database, migration và seed
e2e/                test trình duyệt Playwright
docs/               kiến trúc, hướng dẫn và vận hành
scripts/            công cụ bảo trì, kiểm tra an toàn database
.github/workflows/  việc GitHub tự chạy khi có code mới
```

Các thư mục trong ngoặc như `(auth)`, `(public)`, `(dashboard)` là **route group**.
Chúng giúp tổ chức code và layout nhưng không xuất hiện trong URL.

Quy ước quan trọng:

- `page.tsx`: nội dung một trang.
- `layout.tsx`: khung dùng chung cho nhóm trang.
- `route.ts`: HTTP API Route Handler.
- `loading.tsx`: giao diện trong lúc chờ.
- `error.tsx`: giao diện khi phần đó lỗi.
- `not-found.tsx`: trang không tìm thấy.

---

## 4. Frontend: phần người dùng nhìn thấy

### Thành phần giao diện (component)

Component là hàm trả về giao diện. Ví dụ `ArtistCard` có thể nhận tên, ảnh và
rating rồi render cùng một mẫu ở nhiều nơi. Chia component giúp tránh copy code,
nhưng chia quá nhỏ cũng làm khó theo dõi.

### Props, state và event

- **Props:** dữ liệu cha truyền xuống con, ví dụ `profileId`.
- **State:** dữ liệu thay đổi trong component, ví dụ dialog đang mở hay đóng.
- **Event handler:** hàm chạy khi người dùng bấm, nhập hoặc gửi form.
- **Hook:** hàm React như `useState`, `useEffect` hoặc hook tự viết để dùng lại
  logic.

### Server Component và Client Component

Next.js mặc định dùng Server Component: code chạy ở server, có thể đọc database
và gửi HTML đã render xuống trình duyệt. Client Component có dòng `"use client"`
và cần khi dùng state, effect, event hoặc API trình duyệt.

Server Component thường giảm JavaScript gửi xuống máy người dùng. Vì vậy chỉ
dùng `"use client"` khi thật sự cần.

### SSR, hydration và bundle

- **SSR/server rendering:** server tạo HTML ban đầu.
- **Hydration:** React trên trình duyệt gắn hành vi tương tác vào HTML đó.
- **Bundle:** tập JavaScript/CSS trình duyệt phải tải.
- **Payload:** tổng dữ liệu truyền qua mạng.

Nếu server và client render khác nhau, React có thể báo hydration mismatch. Nếu
bundle hoặc catalog bản dịch quá lớn, trang tải chậm dù server xử lý nhanh.

### CSS và responsive

Tailwind dùng class như `flex`, `px-4`, `text-sm`. Fgrapher thiết kế mobile-first:
class cơ bản dành cho màn hình nhỏ, sau đó `sm:`, `md:`, `lg:` ghi đè cho màn hình
lớn hơn.

**Responsive** nghĩa là giao diện thích nghi kích thước màn hình. `hidden` bằng
CSS chỉ làm một cây không nhìn thấy, không chắc đã unmount component; vì vậy
component ẩn vẫn có thể gọi API nếu được render hai lần.

### Khả năng tiếp cận (accessibility)

Accessibility giúp người dùng bàn phím, screen reader hoặc hạn chế thị giác.
Những điểm cần kiểm tra: label của input, focus, độ tương phản, nút có tên dễ hiểu,
dialog giữ focus và thao tác được không cần chuột.

### Form, upload và kéo thả

`react-hook-form` giữ giá trị, lỗi và trạng thái gửi của form. Zod mô tả quy tắc
dữ liệu. Hai công cụ có thể nối với nhau qua resolver, nhưng server vẫn phải kiểm
tra lại vì người dùng có thể bỏ qua giao diện và gọi API trực tiếp.

Với upload, `react-dropzone` nhận file còn `react-easy-crop` chỉ giúp chọn vùng
ảnh. Việc kéo thả bằng `dnd-kit` thay đổi thứ tự hiển thị; sau đó API phải lưu thứ
tự mới. Giao diện cần có cách thao tác bằng bàn phím, thông báo file sai loại hoặc
quá lớn, và không được xem preview trên trình duyệt là bằng chứng file an toàn.

### Đa ngôn ngữ, ngày giờ và chế độ sáng/tối

`next-intl` chọn chuỗi theo locale. Key bản dịch phải tồn tại ở cả `vi.json` và
`en.json`; không nên viết trực tiếp câu hiển thị rải rác trong component. Locale
cũng ảnh hưởng cách viết ngày, số và tiền tệ.

Ngày lưu trong database thường là một mốc UTC. Khi hiển thị, ứng dụng đổi sang múi
giờ phù hợp. `date-fns` hỗ trợ tính và định dạng ngày, nhưng lập trình viên vẫn phải
phân biệt “một thời điểm” với “một ngày trên lịch” để tránh lệch ngày.

`next-themes` lưu lựa chọn sáng/tối và gắn class theme lên trang. Code chạy ở server
chưa biết chắc theme trong trình duyệt, nên đọc theme quá sớm có thể gây hydration
mismatch. Icon từ Lucide là hình vector; nút chỉ có icon vẫn cần nhãn cho screen
reader. Mã QR do thư viện `qrcode` tạo chỉ mã hoá URL, không tự chứng minh URL đó an
toàn hoặc người quét có quyền xem nội dung.

---

## 5. Backend và API

### HTTP request/response

Trình duyệt gọi API bằng HTTP:

- `GET`: đọc dữ liệu.
- `POST`: tạo hoặc thực hiện hành động.
- `PUT`/`PATCH`: cập nhật.
- `DELETE`: xoá.

Response có status code:

- `200`: thành công;
- `201`: đã tạo;
- `400`: dữ liệu sai;
- `401`: chưa đăng nhập;
- `403`: đã đăng nhập nhưng không có quyền;
- `404`: không tìm thấy;
- `409`: xung đột trạng thái;
- `422`: dữ liệu đúng định dạng nhưng không chấp nhận được;
- `429`: gọi quá nhiều;
- `500`: lỗi phía server.

Fgrapher chuẩn hoá JSON theo dạng `{ data, error, message }`.

### Route Handler, service và lib

Route Handler nhận request, kiểm tra auth, parse input rồi gọi service. Service
chứa quy tắc nghiệp vụ như “booking chỉ được xác nhận từ PENDING”. `lib` chứa
công cụ dùng chung như format ngày, tạo URL hoặc hash token.

Tách lớp giúp API route ngắn, quy tắc được dùng lại và dễ test. Business logic
không nên nằm rải rác trong component.

### Validation bằng Zod

TypeScript chỉ kiểm tra lúc phát triển; dữ liệu từ Internet vẫn có thể là bất kỳ
thứ gì. Zod kiểm tra tại runtime, ví dụ email hợp lệ, giá không âm, danh sách ảnh
không vượt giới hạn. Validation phía client tạo trải nghiệm nhanh; validation phía
server mới là ranh giới bảo mật.

### Middleware/proxy

Middleware là code chạy trước route để xử lý chung. Next.js 16 dùng convention
`proxy.ts` cho phần phát hiện locale. Không nên đặt toàn bộ auth vào middleware;
route bảo vệ vẫn phải gọi `requireAuth()` hoặc `requireRole()`.

### Phân trang, tìm kiếm và debounce

API trả danh sách cần giới hạn số dòng bằng `limit`/`take` và vị trí bắt đầu bằng
cursor hoặc offset. Nếu trả toàn bộ booking, tin nhắn hoặc profile, dữ liệu và thời
gian query sẽ tăng dần theo số người dùng.

Debounce chờ người dùng ngừng gõ một khoảng ngắn rồi mới tìm kiếm. Nó giảm request
thừa nhưng không thay thế rate limit ở server. Khi nhiều request tìm kiếm cùng chạy,
giao diện cần bỏ kết quả cũ về muộn để tránh hiển thị sai từ khoá hiện tại.

---

## 6. Database và Prisma

### Bảng, dòng, cột và khoá

- **Table/bảng:** một nhóm dữ liệu, ví dụ `users`.
- **Row/dòng:** một bản ghi user.
- **Column/cột:** một thuộc tính như `email`.
- **Primary key:** mã duy nhất của dòng, thường là `id`.
- **Foreign key:** mã nối sang bảng khác.
- **Unique constraint:** ràng buộc không được trùng.
- **Index:** cấu trúc giúp tìm nhanh, đổi lại tốn bộ nhớ và chi phí ghi.

### Quan hệ

- Một-một: một user có một đối tượng liên quan duy nhất trong một ngữ cảnh.
- Một-nhiều: một user có nhiều booking.
- Nhiều-nhiều: user có nhiều role và role có nhiều user, nối qua `UserRole`.

### Prisma schema và client

`prisma/schema.prisma` mô tả model, enum, quan hệ, index và constraint. `prisma
generate` tạo Prisma Client có kiểu TypeScript. Code dùng `findUnique`, `findMany`,
`create`, `update`, `deleteMany`, `count`, `groupBy` thay vì tự ghép SQL.

Prisma không thay thế kiến thức SQL. Cần hiểu query nào lấy bao nhiêu dòng, có
index hay không và có gây N+1 query hay không.

### Thay đổi có phiên bản (migration)

Migration là file có phiên bản để đổi schema có kiểm soát. Quy trình:

```text
schema mới → migration ở dev → kiểm tra Preview → migrate deploy Production
```

`db push` đồng bộ nhanh nhưng không tạo lịch sử migration, chỉ phù hợp dev và đã
có script chặn nhầm production. Migration xoá/đổi tên cột cần chia nhiều đợt để
code cũ và code mới cùng chạy được trong lúc deploy.

### Transaction và tính nguyên tử

Transaction gom nhiều lệnh database thành một đơn vị: hoặc tất cả thành công,
hoặc tất cả quay lui. Ví dụ chấp nhận offer phải tạo booking và đổi trạng thái
offer nhất quán.

**Atomic operation** là thao tác không bị chen giữa. `updateMany` có điều kiện,
unique constraint và transaction thường được dùng để phân xử hai request chạy
cùng lúc.

### Race condition và lock

Race condition xảy ra khi kết quả phụ thuộc thứ tự hoàn tất. Ví dụ hai request
cùng xin reset mật khẩu có thể để lại hai token nếu cùng xoá rồi cùng tạo.

Fgrapher dùng:

- unique constraint;
- update có điều kiện;
- transaction;
- Postgres advisory lock cho một phạm vi như một user/credential;
- idempotency key cho email và webhook.

### N+1 query

N+1 là một query lấy danh sách rồi thêm một query cho từng dòng. Ví dụ tìm 100
provider rồi đọc preference 100 lần. Cách tốt hơn là include/select dữ liệu cần
ngay trong query đầu và ghi hàng loạt bằng `createMany`.

---

## 7. Đăng nhập, phân quyền và bảo mật

### Authentication và authorization

- **Authentication (xác thực):** bạn là ai? Ví dụ đăng nhập bằng mật khẩu.
- **Authorization (phân quyền):** bạn được làm gì? Ví dụ chỉ admin được duyệt KYC.

NextAuth giữ session đăng nhập. `requireAuth()` kiểm tra session;
`requireRole()` và các helper khác kiểm tra quyền ở server.

### Session, cookie và CSRF

Session là trạng thái đăng nhập. Cookie là dữ liệu nhỏ trình duyệt tự gửi theo
request cùng domain. Cookie nhạy cảm nên dùng `HttpOnly`, `Secure`, `SameSite`
phù hợp. CSRF là việc website xấu lừa trình duyệt đã đăng nhập gửi request; thư
viện auth và kiểm tra origin/token giúp giảm rủi ro.

### Mật khẩu và bcrypt

Mật khẩu không được lưu dạng rõ. `bcrypt` tạo hash chậm có salt, khiến việc thử
hàng triệu mật khẩu tốn thời gian. Khi đăng nhập, hệ thống hash/compare chứ không
giải mã mật khẩu.

### Token và SHA-256

Token reset/xác minh là chuỗi ngẫu nhiên đủ dài. Người dùng nhận token gốc; database
ưu tiên lưu SHA-256. Khi người dùng gửi token, server hash lại để tìm. Nếu database
bị lộ, hash không thể dùng trực tiếp như link.

Token phải có TTL, dùng một lần và bị xoá/thu hồi sau khi dùng hoặc khi cấp token
mới.

### Đăng nhập uỷ quyền (OAuth)

OAuth cho phép Google xác nhận danh tính mà Fgrapher không thấy mật khẩu Google.
`client_id` nhận diện ứng dụng; `client_secret` là bí mật server; redirect URL phải
khớp cấu hình để chống chuyển hướng giả.

### Giới hạn tần suất gọi (rate limiting)

Rate limit giới hạn số request theo IP, email hoặc user trong một khoảng thời gian.
Nó giảm spam, brute force và chi phí, nhưng không thay thế auth. Endpoint nhạy cảm
cần phản hồi giống nhau để tránh account enumeration.

### XSS, SQL injection và open redirect

- **XSS:** dữ liệu người dùng trở thành script trong trang. React escape text mặc
  định; HTML email và `dangerouslySetInnerHTML` cần xử lý riêng.
- **SQL injection:** input trở thành câu lệnh SQL. Prisma parameterize query giúp
  phòng ngừa; raw SQL vẫn phải dùng tham số.
- **Open redirect:** kẻ xấu đưa URL bên ngoài vào callback để lừa người dùng.
  `isSafeInternalPath()` chỉ cho đường dẫn nội bộ.

### CSP và secret

CSP giới hạn nguồn script, ảnh, video được trình duyệt tải. Cấu hình thiếu
`media-src` từng làm video Cloudinary không phát. Secret như database password,
API key và `NEXTAUTH_SECRET` chỉ nằm trong biến môi trường, không commit `.env`.

---

## 8. Dữ liệu cá nhân và tuân thủ

### KYC và dữ liệu nhạy cảm

KYC là xác minh danh tính bằng giấy tờ và selfie. Ảnh KYC nằm ở khu vực Cloudinary
không công khai, truy cập bằng signed URL sống ngắn, mọi lần admin xem phải ghi
audit log và dữ liệu tự xoá theo thời hạn.

### Sự đồng ý theo mục đích (consent)

Consent là bằng chứng người dùng đồng ý cho từng mục đích. Không gộp nhiều mục
đích vào một checkbox, không tick sẵn. Cần lưu thời gian, phiên bản chính sách,
IP và nội dung/mục đích đã đồng ý.

### Nhật ký kiểm toán (audit log)

Audit log trả lời ai làm gì, với đối tượng nào, lúc nào. Nó khác application log:
audit phục vụ trách nhiệm và điều tra hành động; log kỹ thuật phục vụ debug lỗi.

### Xoá mềm và retention

Soft delete điền `deletedAt` thay vì xoá dòng ngay. Retention là quy định giữ dữ
liệu bao lâu. Giữ vô hạn “để phòng khi cần” vừa tốn tài nguyên vừa tăng rủi ro khi
dữ liệu bị lộ.

---

## 9. Ảnh, video và lưu trữ

Cloudinary lưu file và tạo biến thể: thumbnail, ảnh hiển thị, bản nhỏ cho
moderation. `publicId` là mã tài nguyên; URL là đường truy cập.

Upload có chữ ký giúp Cloudinary biết request được server Fgrapher cho phép. Client
không được giữ API secret. File cần giới hạn loại, dung lượng và số lượng ở cả
client lẫn server.

Ảnh có EXIF chứa thông tin thiết bị, thời gian và đôi khi GPS. Biến đổi qua
Cloudinary thường mã hoá lại và bỏ metadata, nhưng không nên tự giả định cho file
gốc hoặc cấu hình khác.

CDN phân phối file từ vị trí gần người dùng và cache nội dung tĩnh. Xoá URL khỏi
database không đồng nghĩa file vật lý ở Cloudinary đã bị xoá; cần lifecycle riêng.

Bộ kiểm duyệt ảnh tự động chỉ tạo tín hiệu và mức tin cậy để ưu tiên hàng chờ.
Quyết định xử lý tài khoản thuộc về người kiểm duyệt. Đây là mô hình
**human-in-the-loop**: máy hỗ trợ sàng lọc, con người xem ngữ cảnh và chịu trách
nhiệm quyết định. Trước khi gửi ảnh sang dịch vụ AI bên ngoài phải xác định rõ dữ
liệu nào được gửi, nơi xử lý và consent nào cho phép việc đó. Ảnh KYC không được đi
qua luồng kiểm duyệt portfolio.

---

## 10. Email, hàng đợi và công việc nền

Gửi email là thao tác mạng có thể chậm hoặc lỗi. Outbox tách “nghiệp vụ đã thành
công” khỏi “email đã tới nhà cung cấp”. Dòng `PENDING` được cron thử lại với
backoff. Chi tiết ở `docs/ops/email-outbox.md`.

Khái niệm chính:

- **Queue/hàng đợi:** danh sách việc chờ xử lý.
- **Worker:** tiến trình nhận việc.
- **Retry:** thử lại lỗi tạm thời.
- **Backoff:** tăng thời gian chờ sau mỗi lỗi.
- **Dead/terminal:** công việc không thử tiếp.
- **Idempotency:** xử lý cùng sự kiện nhiều lần vẫn tạo một kết quả.
- **At-least-once:** việc có thể chạy lại; handler phải chịu được lặp.

Cron là công việc chạy theo lịch, ví dụ hết hạn booking, gửi nhắc lịch, retry email
hoặc dọn KYC. Mọi cron production phải xác thực bằng `CRON_SECRET` và an toàn khi
hai lần chạy chồng nhau.

---

## 11. Thông báo và polling

Thông báo có hai kênh: in-app và email. Policy quyết định sự kiện nào critical,
sự kiện nào theo preference và feature flag nào quản lý. Xem
`docs/ops/notification-matrix.md`.

Fgrapher hiện dùng polling thay vì WebSocket. `usePolling` dừng khi tab ẩn, không
chồng request và cập nhật ngay khi quay lại. Polling đơn giản hơn realtime nhưng
tạo request đều đặn; interval phải cân bằng độ mới và chi phí.

WebSocket giữ kết nối hai chiều lâu dài và server đẩy dữ liệu xuống ngay. Nó phù
hợp khi lượng chat lớn nhưng thêm hạ tầng, kết nối, retry và đồng bộ trạng thái.

Twilio Verify gửi mã SMS để xác minh số điện thoại. Số điện thoại dùng chuẩn E.164,
ví dụ `+849...`. Vì mỗi tin có thể tốn tiền, endpoint gửi mã cần giới hạn theo tài
khoản, IP và số điện thoại để tránh **SMS toll fraud**: kẻ xấu tự động kích hoạt rất
nhiều SMS nhằm gây chi phí. Khi thiếu biến môi trường Twilio, hệ thống phải báo rõ
môi trường chưa cấu hình; mã bỏ qua dành cho dev không được hoạt động ở production.

---

## 12. Cache và hiệu năng

Cache giữ kết quả đã tính để request sau dùng lại. Nó giảm query và thời gian phản
hồi nhưng có nguy cơ hiển thị dữ liệu cũ.

Ba câu hỏi luôn phải trả lời:

1. Cache key phân biệt dữ liệu nào?
2. TTL bao lâu?
3. Khi dữ liệu đổi, nơi nào invalidate cache?

`unstable_cache` của Next.js đang dùng cho dữ liệu công khai phù hợp như geography,
search và profile. Dữ liệu theo user hoặc availability thay đổi nhanh không nên
đưa vào shared cache. Cache tag cho phép xoá đúng nhóm sau mutation.

Các chỉ số phổ biến:

- **Latency:** thời gian một request hoàn tất.
- **Throughput:** số request xử lý trong một khoảng thời gian.
- **CPU/memory:** tài nguyên tính toán và bộ nhớ.
- **Database round-trip:** một lượt đi-về tới database.
- **LCP:** thời điểm nội dung lớn chính xuất hiện trên màn hình.
- **Bundle size:** lượng JavaScript tải xuống.

Tối ưu phải dựa trên phép đo. Giảm một query hiếm khi chạy có thể kém giá trị hơn
dừng polling thừa mỗi hai giây cho mọi người dùng.

---

## 13. Feature flag và phạm vi MVP

Feature flag là biến cấu hình bật/tắt tính năng mà không đổi code. Fgrapher dùng
flag cho billing, MoMo, ZaloPay, chuyển khoản, marketplace, social feed và content
moderation.

Flag phải được kiểm tra ở cả UI và server. Chỉ ẩn nút không bảo vệ API. Khi flag
tắt, dữ liệu cũ cũng không nên xuất hiện trong list/count.

MVP là phiên bản nhỏ nhất đủ giải quyết nhu cầu chính và học từ người dùng thật.
Code social/marketplace được giữ lại nhưng tắt để giảm phạm vi vận hành.

---

## 14. Thanh toán và webhook

Payment intent là một lần người dùng định thanh toán. Provider như MoMo/ZaloPay
gọi webhook/IPN về server để báo kết quả. Không được tin trình duyệt báo “thành
công”; server phải xác minh chữ ký và trạng thái từ provider.

Webhook có thể gửi lặp, đến muộn hoặc sai thứ tự. `WebhookEvent`, unique key và
state transition giúp xử lý idempotent. State machine quy định trạng thái nào được
chuyển sang trạng thái nào, ví dụ `PENDING → CONFIRMED`, không cho `CANCELLED`
quay lại `CONFIRMED` tuỳ ý.

Stripe còn code nhưng bị tắt theo quyết định phạm vi và điều kiện kinh doanh tại
Việt Nam. MoMo, ZaloPay và chuyển khoản cũng mặc định tắt cho tới khi vận hành sẵn
sàng.

---

## 15. Kiểm thử và chất lượng

### Các tầng kiểm thử

- **Unit test:** kiểm tra một hàm hoặc policy nhỏ, nhanh và cô lập.
- **Integration test:** kiểm tra nhiều phần kết hợp, ví dụ service với store giả.
- **E2E test:** Playwright mở trình duyệt và đi qua luồng người dùng.
- **Visual regression:** so ảnh chụp giao diện với ảnh chuẩn.
- **Smoke test:** vài kiểm tra nhanh xác nhận bản deploy còn hoạt động.
- **Mutation test thủ công:** cố ý làm sai code để xác nhận test thật sự đỏ.

Test tốt bảo vệ hành vi, không chép lại implementation. Một test chỉ tìm chuỗi
trong source dễ vỡ khi refactor và không chứng minh code chạy đúng; chỉ nên dùng
cho wiring khó quan sát bằng test thường.

### Bốn kiểm tra cơ bản

```bash
pnpm lint       # quy tắc code
pnpm typecheck  # kiểu TypeScript
pnpm test       # test logic
pnpm build      # build giống production
```

Test pass không chứng minh không còn bug. Integration thật như Resend, Cloudinary,
payment và OAuth vẫn cần kiểm tra end-to-end với credential thật.

---

## 16. Git, nhánh và CI/CD

Git lưu lịch sử thay đổi bằng commit. Nhánh cho phép làm việc tách khỏi `master`.
Pull request là nơi review trước khi gộp.

- **Working tree:** file hiện tại trên máy.
- **Staged:** thay đổi đã chọn cho commit.
- **Commit:** một mốc lịch sử có mã hash.
- **origin:** repo từ xa, thường trên GitHub.
- **ahead 13:** local có 13 commit chưa push.
- **merge:** gộp lịch sử hai nhánh.
- **conflict:** Git không tự quyết định được hai thay đổi cùng chỗ.

Husky chạy hook Git trên máy lập trình viên. `lint-staged` chỉ kiểm tra file đã đưa
vào vùng staged trước khi commit. Đây là lớp phản hồi sớm; CI vẫn phải chạy lại vì
hook local có thể bị bỏ qua hoặc môi trường mỗi máy khác nhau.

CI là kiểm tra tự động trên GitHub Actions. CD là đưa bản đã đạt điều kiện lên môi
trường. Trong dự án, push/PR chạy lint, typecheck, test và Playwright; merge
`master` khiến Vercel deploy. Migration production có bước duyệt thủ công.

Commit local chưa ảnh hưởng người dùng. Push đưa commit lên GitHub. Deploy mới
ảnh hưởng môi trường chạy; ba hành động này khác nhau và phải báo cáo rõ.

---

## 17. Môi trường và triển khai

- **Local:** web trên máy, dùng database dev.
- **Preview:** link Vercel cho nhánh/PR, hiện dùng chung database dev.
- **Production:** web thật, database riêng.

Environment variable chứa cấu hình thay đổi theo môi trường. Secret chỉ đặt ở máy
hoặc dashboard, không commit. `DATABASE_URL` có thể qua pooler cho app; `DIRECT_URL`
dùng kết nối trực tiếp khi migration.

Vercel chạy phần backend theo kiểu serverless function: một request có thể khởi
động một phiên xử lý ngắn rồi kết thúc. Vì nhiều phiên có thể xuất hiện cùng lúc,
không nên giữ trạng thái quan trọng trong biến nhớ của một tiến trình. Database là
nguồn trạng thái chung. Connection pooler giúp nhiều function dùng số kết nối
PostgreSQL hữu hạn mà không làm database cạn kết nối.

Deploy code và migrate database là hai bước khác nhau. Trong khoảng code mới đã
lên nhưng migration chưa chạy, hai phiên bản phải tương thích hoặc trang dùng cột
mới sẽ lỗi. Xem `docs/ops/VAN-HANH-PRODUCTION.md` để vận hành và rollback.

---

## 18. Log, giám sát và xử lý sự cố

- **Application log:** thông tin/error do app ghi.
- **Vercel Logs:** log của function đang chạy.
- **Sentry event:** lỗi kèm stack trace, route và ngữ cảnh.
- **Health check:** endpoint đơn giản xác nhận dịch vụ sống.
- **Uptime monitor:** dịch vụ gọi health check định kỳ và báo động.
- **Metric:** số đo theo thời gian như latency, error rate, queue depth.
- **Alert:** thông báo khi metric vượt ngưỡng.

Một hệ thống chưa có alert chỉ được phát hiện lỗi khi người dùng báo. Trước launch
cần cấu hình Sentry và uptime monitor, rồi định nghĩa ai nhận cảnh báo và phản hồi
trong bao lâu.

Khi có lỗi: xác định phạm vi → xem log theo thời điểm/user → tái hiện ở Preview →
sửa và thêm test → kiểm tra → deploy → theo dõi. Nếu lỗi nặng xuất hiện ngay sau
deploy, rollback trước rồi điều tra.

---

## 19. Các khái niệm kiến trúc đang dùng

### Tách trách nhiệm (separation of concerns)

Mỗi lớp chịu một trách nhiệm: component hiển thị, route nhận HTTP, service xử lý
nghiệp vụ, Prisma truy cập database. Khi mọi thứ dồn vào một file, thay đổi nhỏ dễ
làm hỏng phần không liên quan.

### Một nguồn dữ liệu chuẩn (single source of truth)

Một quy tắc chỉ nên có một nguồn chính. Ví dụ giới hạn reference media dùng hằng
số chung; notification dùng `NOTIFICATION_POLICY`. Hai con số copy ở hai nơi sẽ
sớm lệch nhau.

### Truyền phần phụ thuộc từ bên ngoài (dependency injection)

Một hàm nhận `store`, `writer` hoặc `send` từ bên ngoài khi test, thay vì luôn gọi
dịch vụ thật. Nhờ vậy test được race, lỗi database và email mà không gửi thật.

### Hàm thuần (pure function)

Hàm thuần chỉ phụ thuộc input và không gây side effect. Policy thuần dễ test hơn
hàm vừa quyết định vừa ghi database.

### Tác động bên ngoài (side effect)

Tác động ra ngoài hàm: ghi database, gửi email, gọi mạng, ghi file hoặc log. Side
effect cần error handling, retry và idempotency.

### Fail closed và fail open

- **Fail closed:** khi không chắc thì từ chối, phù hợp auth và quyền truy cập.
- **Fail open:** khi dịch vụ phụ lỗi vẫn cho nghiệp vụ chính tiếp tục, phù hợp bộ
  quét chỉ sắp xếp hàng chờ hoặc thông báo phụ.

Quyết định nào dùng kiểu nào phải dựa vào hậu quả. Không có một lựa chọn đúng cho
mọi trường hợp.

---

## 20. Lộ trình học đề xuất

### Tuần 1: hiểu web và repo

1. HTTP, request/response, status code.
2. HTML, CSS, JavaScript cơ bản.
3. Đọc `src/app`, `src/components`, mở một `page.tsx` và lần theo component.
4. Chạy local, dùng DevTools xem Network và Console.

### Tuần 2: React và Next.js

1. Component, props, state, event, hook.
2. Server/Client Component, render và hydration.
3. App Router, layout, page và Route Handler.
4. Lần theo một form từ UI đến API.

### Tuần 3: backend và database

1. SQL cơ bản: SELECT, WHERE, JOIN, INSERT, UPDATE.
2. Bảng, foreign key, index, unique constraint.
3. Prisma schema và query.
4. Transaction, race condition, N+1.

### Tuần 4: bảo mật và vận hành

1. Session, cookie, auth, role.
2. Hash, token, OAuth, rate limit.
3. Git, CI/CD, local/preview/production.
4. Log, Sentry, cron, queue, retry và rollback.

### Bài thực hành với Fgrapher

1. Chọn API `GET /api/notifications` và vẽ đường đi từ route → service → Prisma.
2. Chọn form đăng ký và liệt kê validation ở client và server.
3. Mở schema, vẽ quan hệ `User → UserRole → Profile`.
4. Dùng DevTools đếm request của chat trong 20 giây, rồi ẩn tab.
5. Đọc một test token reset và giải thích vì sao replay bị từ chối.
6. Mở một commit, phân biệt thay đổi code, test và tài liệu.

---

## 21. Checklist khi duyệt một thay đổi

### Với giao diện

- Mobile và desktop có dùng được không?
- Loading, empty và error state có đủ không?
- Bàn phím/screen reader có thao tác được không?
- Có render component hai lần chỉ để ẩn bằng CSS không?
- Chuỗi có nằm trong hệ thống i18n không?

### Với API và nghiệp vụ

- Server đã xác thực, phân quyền và validation chưa?
- Có thể gọi lặp hay gọi đồng thời không?
- Lỗi dịch vụ phụ có làm hỏng nghiệp vụ chính không?
- Danh sách đã phân trang hoặc giới hạn chưa?
- Có N+1 query hoặc ghi tuần tự không cần thiết không?

### Với database

- Constraint nào bảo vệ quy tắc?
- Query mới có index phù hợp không?
- Migration có chạy an toàn với code cũ không?
- Có retention và xoá dữ liệu liên quan không?

### Với bảo mật

- Có log token, mật khẩu, secret hoặc dữ liệu cá nhân không?
- Phản hồi có làm lộ tài khoản tồn tại không?
- URL callback/upload có được kiểm tra không?
- Feature flag có được kiểm tra ở server không?

### Trước khi deploy

- Lint, typecheck, test và build đều đạt?
- Có test bảo vệ đúng lỗi hoặc hành vi mới?
- Tài liệu và biến môi trường đã cập nhật?
- Có migration không, ai sẽ duyệt?
- Cách rollback là gì?

---

## 22. Bảng tra nhanh thuật ngữ Anh–Việt

| Thuật ngữ      | Cách hiểu ngắn                                   |
| -------------- | ------------------------------------------------ |
| API            | Cổng để phần mềm gọi chức năng/dữ liệu của nhau  |
| Backend        | Code chạy phía máy chủ                           |
| Frontend       | Giao diện chạy trong trình duyệt                 |
| Runtime        | Môi trường code thực thi                         |
| Framework      | Bộ khung và quy ước để xây ứng dụng              |
| Library        | Thư viện cung cấp một nhóm chức năng             |
| Dependency     | Gói mà dự án phụ thuộc                           |
| Endpoint       | Một địa chỉ API cụ thể                           |
| Payload        | Dữ liệu truyền trong request/response            |
| Schema         | Bản mô tả cấu trúc dữ liệu                       |
| ORM            | Lớp ánh xạ object trong code với bảng database   |
| Query          | Yêu cầu đọc/ghi database                         |
| Constraint     | Quy tắc database bắt buộc tuân theo              |
| Transaction    | Nhóm thao tác cùng thành công hoặc cùng quay lui |
| Cache          | Bản dữ liệu giữ tạm để dùng lại nhanh            |
| Invalidation   | Làm cache cũ hết hiệu lực                        |
| TTL            | Thời gian một dữ liệu/token/cache còn hiệu lực   |
| Queue          | Hàng đợi công việc                               |
| Cron           | Công việc tự chạy theo lịch                      |
| Retry          | Thử lại sau lỗi                                  |
| Timeout        | Dừng vì chờ quá lâu                              |
| Concurrency    | Nhiều việc chạy trong cùng khoảng thời gian      |
| Race condition | Kết quả sai do thứ tự hoàn tất không đoán trước  |
| Lock           | Cơ chế cho một tiến trình độc quyền tạm thời     |
| Idempotent     | Chạy lặp vẫn cho cùng một tác dụng               |
| Webhook        | HTTP callback từ dịch vụ ngoài về app            |
| OAuth          | Đăng nhập uỷ quyền qua nhà cung cấp như Google   |
| Session        | Trạng thái cho biết người dùng đã đăng nhập      |
| Hash           | Dấu vân tay một chiều của dữ liệu                |
| Encryption     | Mã hoá có thể giải mã bằng khoá                  |
| Secret         | Giá trị bí mật chỉ server được biết              |
| Feature flag   | Công tắc bật/tắt tính năng bằng cấu hình         |
| Deploy         | Đưa phiên bản code lên môi trường chạy           |
| Rollback       | Quay lại phiên bản trước                         |
| CI/CD          | Kiểm tra và triển khai tự động                   |
| Log            | Nhật ký hệ thống                                 |
| Metric         | Số đo theo thời gian                             |
| Alert          | Cảnh báo khi có dấu hiệu bất thường              |
| Regression     | Chức năng cũ bị hỏng sau thay đổi mới            |
| Refactor       | Sắp xếp lại code mà không đổi hành vi            |
| Technical debt | Giải pháp tạm làm tăng chi phí sửa về sau        |

---

## 23. Nên đọc tiếp ở đâu trong repo?

1. `README.md` và `CLAUDE.md`: mục tiêu, ràng buộc và công nghệ.
2. `docs/ARCHITECTURE.md`: cấu trúc hệ thống.
3. `docs/ops/VAN-HANH-PRODUCTION.md`: vận hành và rollback.
4. `docs/ops/email-verification.md`: ví dụ hoàn chỉnh về auth/token/race.
5. `docs/ops/email-outbox.md`: ví dụ queue/retry/idempotency.
6. `docs/ops/polling.md`: ví dụ đo hiệu năng frontend.
7. `prisma/schema.prisma`: bản đồ dữ liệu toàn dự án.
8. Một API route ngắn, rồi lần theo service và test tương ứng.

Đừng cố nhớ mọi thuật ngữ. Hãy chọn một luồng thật, vẽ đường đi của dữ liệu và
tra lại khái niệm khi gặp. Sau vài luồng như đăng ký, đặt lịch, tin nhắn và email,
cấu trúc toàn dự án sẽ bắt đầu lặp lại và trở nên dễ đoán.
