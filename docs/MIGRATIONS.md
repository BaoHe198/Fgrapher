# Thay đổi cấu trúc database bằng migration

Migration là file SQL có phiên bản, dùng để đưa cấu trúc database từ trạng thái cũ
sang trạng thái mới. Nó giúp mọi môi trường thực hiện cùng một thay đổi và lưu lại
lịch sử để kiểm tra.

## 1. Quy tắc của Fgrapher

- Tạo migration trên máy local với database dev.
- Đọc SQL do Prisma sinh ra trước khi commit.
- Kiểm tra ở local và Preview.
- Production chỉ chạy `prisma migrate deploy` qua quy trình đã được duyệt.
- Không dùng `db push`, `migrate dev` hoặc `reset` với production.

Preview dùng chung `fgrapher-dev`, nên migration đã áp dụng ở local sẽ ảnh hưởng dữ
liệu mà các bản Preview đang đọc.

## 2. Tạo migration

1. Sửa `prisma/schema.prisma`.
2. Tạo migration:

   ```bash
   pnpm db:migrate:dev --name ten_mo_ta_ngan
   ```

3. Mở `prisma/migrations/<timestamp>_ten/migration.sql` và đọc từng câu lệnh.
4. Khởi động lại dev server nếu Prisma Client vừa được generate lại.
5. Thử đúng luồng cần schema mới, không chỉ chạy build.
6. Commit `schema.prisma` và thư mục migration trong cùng thay đổi.

Script `scripts/check-db-safety.mjs` sẽ từ chối nếu kết nối không phải database dev
đã cho phép. Không vô hiệu hoá chốt chặn này để “chạy cho nhanh”.

## 3. Kiểu thay đổi và mức rủi ro

| Thay đổi                 | Cách làm an toàn                                                   |
| ------------------------ | ------------------------------------------------------------------ |
| Thêm cột cho phép `null` | Thường có thể làm trong một migration                              |
| Thêm cột bắt buộc        | Thêm mặc định hợp lý hoặc chia thành nhiều đợt                     |
| Đổi tên cột              | Thêm cột mới, sao chép dữ liệu, đổi code, rồi xoá cột cũ ở đợt sau |
| Xoá cột/bảng             | Chỉ xoá sau khi mọi phiên bản code đã ngừng sử dụng                |
| Đổi kiểu dữ liệu         | Dùng cột mới và backfill nếu dữ liệu cũ có thể chuyển đổi lỗi      |
| Thêm index bảng lớn      | Đánh giá thời gian khoá; cân nhắc `CREATE INDEX CONCURRENTLY`      |
| Thêm giá trị enum        | Kiểm tra code cũ có chịu được giá trị mới không                    |

**Backfill** là việc điền dữ liệu cho các dòng đã tồn tại. Ví dụ muốn một cột mới
trở thành bắt buộc, trước hết phải bảo đảm mọi dòng cũ đều có giá trị.

## 4. Mẫu ba đợt cho thay đổi dễ làm hỏng tương thích

Giả sử cần biến một trường tuỳ chọn thành bắt buộc:

1. **Đợt 1:** thêm trường dạng tuỳ chọn; code mới bắt đầu ghi trường đó.
2. **Backfill:** chạy script điền dữ liệu thiếu và kiểm tra số dòng còn `null`.
3. **Đợt 2:** khi mọi dòng đã hợp lệ, thêm ràng buộc `NOT NULL`.

Cách này giúp code cũ và code mới cùng hoạt động trong khoảng Vercel đang chuyển
phiên bản. Không gộp thêm cột, chuyển toàn bộ dữ liệu, đổi code và xoá cột cũ vào
một bước nếu production vẫn có request đang chạy.

## 5. Khi migration production lỗi

1. Dừng lại và đọc log; không chồng thêm một migration đoán mò.
2. Xác định transaction đã rollback hay database đang ở trạng thái dở dang.
3. Nếu dữ liệu bị ảnh hưởng, dùng bản sao lưu hoặc Point-in-Time Recovery theo kế
   hoạch đã chuẩn bị.
4. Sửa SQL hoặc dữ liệu gây lỗi trên bản thử nghiệm trước.
5. Dùng `prisma migrate resolve --rolled-back <ten-migration>` khi cần đánh dấu đã
   quay lui, hoặc `--applied` khi schema đã được sửa thủ công và chỉ cần đồng bộ sổ
   theo dõi của Prisma.
6. Chỉ chạy lại sau khi đã xác nhận trạng thái sạch.

Không sửa trực tiếp bảng `_prisma_migrations` bằng SQL nếu Prisma đã có lệnh
`migrate resolve` cho việc đó.

## 6. Cập nhật dữ liệu tỉnh/thành và phường/xã

Dữ liệu nguồn được lưu tại
`prisma/data/sources/vietnam-sap-nhap-phuong-xa.xlsx`. Khi thay file nguồn, chạy:

```bash
python3 scripts/import-vietnam-geography.py
pnpm exec prettier --write prisma/data/nationwide-wards.ts
pnpm db:seed:geography
```

Script đầu tiên kiểm tra đủ 34 tỉnh/thành và 3.321 phường/xã rồi sinh lại file
TypeScript. Lệnh seed chỉ thêm dòng còn thiếu và cập nhật tên theo mã ổn định; nó
không xoá địa giới cũ vì các tài khoản đang hoạt động có thể còn tham chiếu đến đó.

Workflow production tự chạy seed địa giới khi `prisma/data`,
`prisma/seed-geography.ts` hoặc `scripts/seed-geography.ts` thay đổi. Bước này vẫn
phải được duyệt trong GitHub Environment `production`, giống migration cấu trúc.

## 7. Checklist trước khi đưa migration lên production

- [ ] Đã đọc toàn bộ SQL được sinh ra.
- [ ] Đã thử trên database dev và Preview.
- [ ] Đã kiểm tra dữ liệu cũ, `null`, giá trị trùng và ràng buộc liên quan.
- [ ] Đã xác nhận bản sao lưu production còn dùng được.
- [ ] Đã ước lượng thời gian khoá với bảng lớn.
- [ ] Code trước và sau migration có tương thích trong lúc deploy.
- [ ] Đã viết cách rollback trước khi bắt đầu.
- [ ] Người có trách nhiệm đã duyệt bước migration production.

Xem `docs/ENVIRONMENTS.md` để phân biệt database và
`docs/ops/VAN-HANH-PRODUCTION.md` để xem quy trình deploy/rollback đầy đủ.
