# Fgrapher — Git và các môi trường

> Tài liệu này từng đề xuất ba database. Kiến trúc hiện tại dùng hai database:
> `fgrapher-dev` và `fgrapher-prod`. Xem `docs/ENVIRONMENTS.md` để biết cấu hình
> hiện hành.

## 1. Các khái niệm cần biết

- **Working tree:** file đang có trên máy.
- **Staged:** thay đổi đã chọn cho commit.
- **Commit:** một mốc lịch sử local.
- **Branch:** nhánh thay đổi tách khỏi nhánh chính.
- **origin:** repository trên GitHub.
- **Pull request:** nơi review trước khi merge.
- **Preview:** bản Vercel của một nhánh/PR.
- **Production:** bản phục vụ người dùng thật.

Commit, push, merge và deploy là bốn hành động khác nhau.

## 2. Sơ đồ hiện tại

```text
feature/* hoặc fix/* ──push──> GitHub ──> Vercel Preview
       │                                  │
       └──────── dùng fgrapher-dev ───────┘

master ──merge/push──> Vercel Production ──> fgrapher-prod
```

Local và Preview dùng chung database dev. Chỉ production dùng database thật.

## 3. Quy trình Git

Tạo nhánh:

```bash
git switch -c fix/mo-ta-ngan
```

Xem thay đổi:

```bash
git status
git diff
```

Kiểm tra rồi commit:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git add <file>
git commit -m "fix(scope): mo ta"
```

Push nhánh và mở PR. Review Preview, test liên quan và migration trước khi merge.

## 4. Quy tắc nhánh và commit

Tên nhánh nên theo `type/mo-ta-ngan`:

- `feat/`: tính năng;
- `fix/`: sửa lỗi;
- `docs/`: tài liệu;
- `refactor/`: sắp xếp code không đổi hành vi;
- `chore/`: bảo trì.

Commit theo `type(scope): description`. Mỗi commit nên có một mục đích rõ và không
trộn refactor lớn với sửa lỗi khẩn cấp.

## 5. Preview

Preview dùng để:

- xem UI thật;
- kiểm tra biến môi trường Preview;
- chạy smoke/E2E;
- cho người review bấm luồng.

Vì dùng chung database dev:

- dữ liệu có thể bị nhánh khác thay đổi;
- migration dev ảnh hưởng mọi Preview;
- không dùng dữ liệu cá nhân thật;
- test không được reset database chung.

## 6. Production

Production secret chỉ nằm trong Vercel Production scope. `NEXTAUTH_SECRET`,
database URL, OAuth, Resend, Cloudinary và cron secret phải khác/đúng môi trường.

Merge `master` có thể kích hoạt deploy code. Migration production là bước riêng có
duyệt; không giả định Vercel tự làm mọi thay đổi database.

## 7. Migration qua môi trường

```text
sửa schema
  ↓
tạo migration với fgrapher-dev
  ↓
đọc SQL + test local/Preview
  ↓
merge code tương thích
  ↓
duyệt và migrate deploy production
```

Với thay đổi phá tương thích, dùng nhiều đợt add/backfill/switch/drop. Xem
`docs/MIGRATIONS.md`.

## 8. Secret và biến môi trường

- Không commit `.env`, `.env.local` hoặc credential.
- Biến `NEXT_PUBLIC_` có thể tới trình duyệt.
- Dev/Preview không dùng key live.
- Production không dùng tài khoản seed hoặc dev bypass.
- Khi rotate secret, ghi rõ ảnh hưởng session/webhook.

## 9. CI/CD

CI nên chạy:

- lint;
- typecheck;
- unit/integration test;
- build;
- Playwright phù hợp;
- kiểm tra migration/an toàn nếu có.

CD chỉ deploy artifact đã qua điều kiện. Check local giúp phản hồi sớm nhưng không
thay CI.

## 10. Rollback

Nếu code mới gây sự cố:

1. rollback Vercel về deployment trước;
2. kiểm tra schema có còn tương thích;
3. không tự rollback migration bằng cách đoán SQL;
4. dùng backup/PITR khi dữ liệu bị hỏng;
5. sửa trên nhánh và redeploy.

Code rollback không tự hoàn tác database.

## 11. Khi có conflict

Đọc cả hai thay đổi và hiểu ý định. Không chọn “ours/theirs” toàn file chỉ để hết
conflict. Sau khi giải quyết, chạy lại test liên quan vì file cuối có thể hợp lệ cú
pháp nhưng sai nghiệp vụ.

## 12. Checklist trước merge

- [ ] Diff đúng phạm vi, không có secret.
- [ ] Tài liệu hiện hành đã cập nhật.
- [ ] Lint/typecheck/test/build đạt.
- [ ] Preview đã kiểm tra.
- [ ] Feature flag và env var đã chuẩn bị.
- [ ] Migration có SQL review, backup và rollback.
- [ ] Không sửa dữ liệu production thủ công.

## Vì sao không dùng database staging thứ ba?

Kế hoạch cũ đề xuất dev/staging/prod. Dự án chọn hai database để phù hợp quy mô và
giới hạn dịch vụ. Khi có nhiều contributor, dữ liệu Preview xung đột hoặc cần diễn
tập gần production, hãy đánh giá staging riêng thay vì tiếp tục dùng dev chung.
