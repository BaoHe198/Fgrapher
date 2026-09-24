# Hệ thống màu sắc và kiểu chữ của Fgrapher

Các giá trị này được trích từ `Fgrapher Web UI Kit.html`. File gốc chỉ có một màn
hình landing page; vì vậy token là định hướng chung, không phải bằng chứng rằng mọi
màn hình dashboard/auth đã được thiết kế sẵn.

Muốn xác minh giá trị chính xác, mở
`docs/design-reference/Fgrapher Web UI Kit.html` trong trình duyệt. Token đã được
đưa vào `src/app/globals.css` và font được cấu hình trong `src/app/layout.tsx`.

## 1. Nhận diện thương hiệu

- Xanh rừng đậm làm màu chính.
- Vàng ấm làm màu nhấn.
- Nền kem/trắng ấm thay cho trắng lạnh.
- Chữ tiêu đề và chữ nội dung dùng hai font khác nhau.
- Nút/badge bo nhiều; card bo 12–16 px.
- Shadow nhẹ, có sắc ấm ở light mode.

## 2. Thang màu

| Mức | Xanh (`--green-*`) | Vàng (`--gold-*`) |
| --- | ------------------ | ----------------- |
| 50  | `hsl(168 40% 96%)` | `hsl(38 55% 96%)` |
| 100 | `hsl(168 40% 90%)` | `hsl(38 55% 90%)` |
| 200 | `hsl(168 38% 80%)` | `hsl(38 50% 80%)` |
| 300 | `hsl(168 36% 66%)` | `hsl(38 48% 70%)` |
| 400 | `hsl(168 38% 50%)` | `hsl(38 46% 60%)` |
| 500 | `hsl(168 45% 36%)` | `hsl(38 44% 52%)` |
| 600 | `hsl(168 50% 26%)` | `hsl(38 46% 44%)` |
| 700 | `hsl(168 55% 20%)` | `hsl(38 48% 36%)` |
| 800 | `hsl(168 58% 15%)` | `hsl(38 50% 28%)` |
| 900 | `hsl(168 60% 11%)` | `hsl(38 52% 20%)` |
| 950 | `hsl(168 62% 7%)`  | —                 |

`--neutral-*` là thang xám ấm dùng cho chữ và bề mặt. `--neutral-0` là
`#ffffff`.

## 3. Token theo ý nghĩa

Thay vì dùng trực tiếp “green-800” ở mọi nơi, token theo ý nghĩa cho biết màu đó
đang phục vụ vai trò gì. Nhờ vậy dark mode có thể đổi giá trị mà component không
cần đổi class.

| Token              | Light mode         | Dark mode          |
| ------------------ | ------------------ | ------------------ |
| `--bg-page`        | `hsl(30 20% 98%)`  | `hsl(30 10% 7%)`   |
| `--bg-surface`     | `#ffffff`          | `hsl(30 9% 11%)`   |
| `--bg-sunken`      | `hsl(30 15% 95%)`  | `hsl(30 9% 9%)`    |
| `--bg-inverse`     | `hsl(168 60% 11%)` | `hsl(168 62% 7%)`  |
| `--surface-card`   | `#ffffff`          | `hsl(30 9% 12%)`   |
| `--text-primary`   | `hsl(30 15% 11%)`  | `hsl(30 15% 95%)`  |
| `--text-secondary` | `hsl(30 8% 38%)`   | `hsl(30 8% 70%)`   |
| `--text-tertiary`  | `hsl(30 7% 52%)`   | `hsl(30 7% 55%)`   |
| `--text-on-brand`  | `#ffffff`          | `hsl(168 62% 7%)`  |
| `--text-link`      | `hsl(168 55% 20%)` | `hsl(38 48% 70%)`  |
| `--border-subtle`  | `hsl(30 12% 90%)`  | `hsl(30 6% 20%)`   |
| `--border-default` | `hsl(30 10% 82%)`  | `hsl(30 6% 27%)`   |
| `--border-strong`  | `hsl(30 8% 68%)`   | `hsl(30 6% 36%)`   |
| `--border-focus`   | `hsl(38 44% 52%)`  | `hsl(38 46% 60%)`  |
| `--brand-primary`  | `hsl(168 58% 15%)` | `hsl(168 38% 50%)` |
| `--brand-accent`   | `hsl(38 46% 60%)`  | Giữ nguyên         |

`--text-on-brand` và `--text-link` có giá trị riêng theo theme; không thay bằng
một màu trong thang chỉ vì nhìn gần giống.

### Màu trạng thái

| Token               | Light mode                              | Dark mode                               |
| ------------------- | --------------------------------------- | --------------------------------------- |
| `--success` / `-bg` | `hsl(168 50% 26%)` / `hsl(168 40% 96%)` | `hsl(168 36% 66%)` / `hsl(168 40% 14%)` |
| `--warning` / `-bg` | `hsl(32 88% 34%)` / `hsl(35 90% 96%)`   | `hsl(35 85% 62%)` / `hsl(35 60% 14%)`   |
| `--danger` / `-bg`  | `hsl(6 70% 46%)` / `hsl(6 70% 96%)`     | `hsl(6 75% 64%)` / `hsl(6 50% 15%)`     |
| `--info` / `-bg`    | `hsl(205 65% 38%)` / `hsl(205 65% 96%)` | `hsl(205 70% 65%)` / `hsl(205 50% 15%)` |

Không chỉ dùng màu để truyền đạt trạng thái; thêm chữ hoặc icon để người mù màu vẫn
hiểu.

## 4. Kiểu chữ

```css
--font-display: "Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif;
--font-body: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
--font-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, monospace;
```

| Token                  | Giá trị                                 |
| ---------------------- | --------------------------------------- |
| `--text-display-2xl`   | `600 4rem/1.05 var(--font-display)`     |
| `--text-display-xl`    | `600 3rem/1.08 var(--font-display)`     |
| `--text-display-lg`    | `600 2.25rem/1.12 var(--font-display)`  |
| `--text-display-md`    | `600 1.75rem/1.2 var(--font-display)`   |
| `--text-display-sm`    | `600 1.625rem/1.2 var(--font-display)`  |
| `--text-heading-xl`    | `600 1.625rem/1.25 var(--font-display)` |
| `--text-heading-lg`    | `600 1.5rem/1.3 var(--font-display)`    |
| `--text-heading-md`    | `600 1.25rem/1.35 var(--font-body)`     |
| `--text-heading-sm`    | `600 1.0625rem/1.5 var(--font-body)`    |
| `--text-body-lg`       | `400 1.0625rem/1.55 var(--font-body)`   |
| `--text-body-md`       | `400 1rem/1.6 var(--font-body)`         |
| `--text-body-sm`       | `400 0.875rem/1.6 var(--font-body)`     |
| `--text-caption`       | `500 0.875rem/1.5 var(--font-body)`     |
| `--text-caption-upper` | `600 0.875rem/1.4 var(--font-body)`     |

Cỡ chữ đã được tăng để chữ Việt có dấu không bị chật dòng và nội dung thường đạt
ngưỡng dễ đọc. Chữ phụ không nên nhỏ hơn 14 px; nội dung chính nên từ 16 px. Luôn
kiểm tra tương phản thực tế trên cả light và dark mode.

## 5. Khoảng cách, bo góc và bóng

Thang khoảng cách `--space-1` đến `--space-14`:

```text
2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128 px
```

```css
--radius-none: 0px;
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-xl: 20px;
--radius-pill: 999px;
```

| Token bóng       | Light mode                         | Dark mode                      |
| ---------------- | ---------------------------------- | ------------------------------ |
| `--shadow-sm`    | `0 1px 2px rgba(18,16,10,0.06)`    | `0 1px 2px rgba(0,0,0,0.4)`    |
| `--shadow-md`    | `0 4px 14px rgba(18,16,10,0.08)`   | `0 4px 14px rgba(0,0,0,0.45)`  |
| `--shadow-lg`    | `0 14px 36px rgba(18,16,10,0.14)`  | `0 14px 36px rgba(0,0,0,0.55)` |
| `--shadow-focus` | `0 0 0 3px hsl(38 44% 52% / 0.35)` | Giữ nguyên                     |

## 6. Mẫu component

### Điều hướng

Logo ở trái, link chính ở giữa và nhóm hành động ở phải. Navigation sticky phải có
độ tương phản rõ, focus bằng bàn phím và menu mobile không làm render trùng những
component có polling.

### Vùng mở đầu (hero)

Dùng nền `--bg-inverse`, tiêu đề sáng và màu vàng cho điểm nhấn. Search bar cần
label/accessible name, focus rõ và không phụ thuộc placeholder để giải thích input.

### Card hồ sơ/sản phẩm

Ảnh ở trên, thông tin chính ở dưới. Tên dài phải clamp; badge vai trò không được ép
nhỏ; card trong cùng grid nên có chiều cao ổn định. Ảnh có kích thước khai báo và
thumbnail phù hợp để tránh layout shift.

### Nút

| Biến thể             | Cách dùng                    |
| -------------------- | ---------------------------- |
| Primary vàng         | Hành động chính của vùng     |
| Secondary viền       | Hành động quan trọng thứ hai |
| Ghost/text           | Hành động nhẹ hoặc link      |
| Filter pill active   | Bộ lọc đang chọn             |
| Filter pill inactive | Bộ lọc chưa chọn             |

Mỗi vùng chỉ nên có một hành động chính nổi bật. Trạng thái disabled phải có lý do
hoặc hướng dẫn khi người dùng có thể tự khắc phục.

## 7. Cách token được ánh xạ vào code

- Thang `--green-*`, `--gold-*`, `--neutral-*` được đăng ký trong Tailwind v4
  và cố ý ghi đè palette trùng tên.
- Semantic token giữ tên đầy đủ. Ví dụ `--bg-surface` dùng utility
  `bg-bg-surface`; `--text-primary` dùng `text-text-primary`.
- Radius trùng với shadcn được đổi namespace thành
  `--fg-radius-sm/md/lg/xl`; dùng `rounded-[var(--fg-radius-md)]`.
- Shadow dùng custom property như `shadow-[var(--shadow-md)]`.
- Typography được khai báo bằng `@utility`, ví dụ `text-display-2xl`.
- Theme app dùng class `.dark` qua `next-themes`.

Không tự suy luận utility từ tên trong file thiết kế. Kiểm tra `globals.css` vì
shadcn và token thương hiệu có một số tên dễ va nhau.

## 8. Khi thêm hoặc sửa giao diện

- Dùng semantic token trước màu hardcode.
- Kiểm tra light/dark, mobile/desktop và focus keyboard.
- Dùng font/cỡ có sẵn trước khi tạo token mới.
- Không dùng chữ tertiary cho nội dung quan trọng nếu tương phản không đủ.
- Không dùng shadow/radius tuỳ ý khiến các màn hình mất nhất quán.
- So với UI Kit nhưng ưu tiên accessibility và trạng thái thật của component.
