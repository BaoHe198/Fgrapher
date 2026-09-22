# Vận hành Local AI Worker cho Fgrapher

Tài liệu này hướng dẫn Claude và Codex giao phần triển khai cho AI chạy trên
máy. Local AI giúp giảm token cloud cho các bước đọc file, sửa code cục bộ và
chạy validation. Claude/Codex vẫn chịu trách nhiệm kiến trúc, phạm vi, review và
quyết định cuối.

## 1. Luồng hoạt động

```text
Claude hoặc Codex
        ↓
Chia task và chọn profile
        ↓
fgrapher-run.py
        ↓
OpenCode → Ollama → local model
        ↓
Audit diff → typecheck → lint → review của Claude/Codex
```

Ollama là runtime chính. Không khởi động thêm model tương đương trong LM Studio
khi worker đang chạy vì cả hai cùng dùng unified memory.

## 2. Hai profile

### Daily

- Model: `ollama/fgrapher-daily`.
- Context mặc định: 32K.
- Dùng cho task khoảng 1–3 file: sửa UI, TypeScript, validation, test, tài liệu,
  API nhỏ và refactor cục bộ.

### Heavy

- Model: `ollama/fgrapher-heavy`.
- Context mặc định: 32K.
- Dùng cho schema, migration, permission, booking/availability, Fmap, search,
  provider architecture và debug cần suy luận sâu.
- Chỉ chạy một task Heavy tại một thời điểm.
- Profile `ollama/fgrapher-heavy-64k` chỉ dùng khi đã loại bỏ context không liên
  quan mà 32K vẫn không đủ.

Heavy không nhận task khổng lồ. Ví dụ thay đổi provider architecture phải được
chia thành audit, migration, types, onboarding, profile, search, Fmap, booking
và regression test.

OpenCode dùng khoảng 16K token cho system prompt và tool definitions trước khi
đọc code. Vì vậy Heavy 32K chỉ nên đọc tối đa 2–3 file vừa hoặc khoảng 8–10K
token source thực sự liên quan. Nếu phạm vi lớn hơn, Claude/Codex phải tìm symbol
trước, trích các đoạn code cần thiết vào prompt hoặc chia audit thành nhiều lượt.
Không giao một lượt vừa đọc nhiều file đầy đủ vừa tổng hợp báo cáo lớn; model có
thể compact context, quên tiến độ và đọc lại từ đầu.

## 3. Chuẩn bị worktree

Worker từ chối repository chính và working tree có thay đổi chưa commit. Tạo
branch/worktree riêng trước khi giao task. Claude và Codex có thể làm song song
trên các worktree khác nhau, nhưng không được khởi chạy hai Heavy model cùng
lúc.

Mỗi worktree phải có dependency riêng. Không symlink `node_modules` từ checkout
khác vì pnpm sẽ từ chối đường dẫn nằm ngoài project root:

```bash
pnpm install --frozen-lockfile
pnpm exec prisma generate
```

Ví dụ lệnh chạy:

```bash
python3 ~/.config/opencode/fgrapher-run.py \
  "Tên task" /tmp/fgrapher-task.md /tmp/fgrapher-task.log \
  --profile daily \
  --repo /đường/dẫn/worktree \
  --allow-file src/components/example.tsx
```

Đổi `daily` thành `heavy` khi task đáp ứng tiêu chí Heavy. Dùng nhiều
`--allow-file` nếu task được phép sửa nhiều file.

## 4. Cấu trúc prompt bắt buộc

Prompt phải có các mục sau:

```text
Goal:
Mô tả một kết quả cụ thể.

Files to inspect:
- File cần đọc.

Allowed files:
- File duy nhất được phép sửa.

Do not modify:
- Module, schema hoặc hành vi phải giữ nguyên.

Dependencies:
- Quy tắc nghiệp vụ và symbol liên quan.

Implementation plan:
- Các bước nhỏ theo thứ tự.

Acceptance criteria:
- Điều kiện quan sát được để xem task hoàn thành.

Validation:
- Lệnh test/typecheck/lint cần chạy.

Rollback considerations:
- Cách hoàn tác và dữ liệu cần bảo vệ.
```

Trích đúng đoạn code hoặc symbol cần sửa nếu đã biết. Không gửi toàn repository,
toàn bộ git history, `node_modules`, build artifact, log không liên quan hoặc
toàn bộ file translation lớn.

Đếm số file không đủ để chọn model. Task 5 file ngắn có thể phù hợp Daily; task
1 file nhưng chứa permission hoặc migration có thể cần Heavy. Chọn theo độ sâu
suy luận rồi tiếp tục giới hạn lượng source phải đọc.

Với task Daily đã có đủ ràng buộc trong prompt, không thêm toàn bộ `CLAUDE.md`
vào `Files to inspect`. Nếu cần một quy tắc trong file dài, tìm đúng heading hoặc
symbol rồi chỉ đọc đoạn nhỏ quanh kết quả.

## 5. Escalation

```text
Daily → validation đạt → Claude/Codex review → hoàn thành
Daily → thiếu khả năng suy luận/context → chia nhỏ lại → Heavy
Daily → sai prompt/file/môi trường → sửa nguyên nhân, không đổi model
Heavy 32K → compact/lặp đọc → trích code hoặc chia task → thử lại 32K
Heavy 32K → vẫn thiếu context sau khi đã thu gọn → Heavy 64K có giám sát
```

Không chuyển Heavy chỉ vì syntax error, thiếu dependency, sai command hoặc
prompt không rõ.

## 6. Quyền và giới hạn

Local AI được đọc, sửa file trong worktree và chạy validation được cho phép.
Local AI không được:

- commit hoặc push;
- deploy Preview/Production;
- chạy migration production;
- reset/clean Git;
- sửa file ngoài danh sách được phép;
- tự mở rộng phạm vi khi validation yêu cầu thay đổi module khác.

Claude/Codex phải đọc diff, kiểm tra file ngoài phạm vi và chạy browser check
khi thay đổi ảnh hưởng UI hoặc hành vi người dùng.

Kết quả test mà worker tự báo không thay thế review. Nếu model dùng type cast,
`any`, bỏ assertion hoặc đổi test để làm validation xanh, Claude/Codex phải xem
đó là lỗi chất lượng dù lint và test có thể vẫn pass.

## 7. Khi worker lỗi hoặc hết bộ nhớ

Theo thứ tự:

1. giảm file và context không liên quan;
2. chia task nhỏ hơn;
3. giảm context từ 64K về 32K;
4. bảo đảm chỉ một model đang load;
5. kiểm tra Memory Pressure và swap;
6. báo lại Claude/Codex nếu vẫn không thể hoàn thành trong phạm vi.

Không tăng context lên 128K hoặc 256K để bù cho prompt thiếu tập trung.

## 8. Kết quả benchmark ngày 22/09/2026

- Daily hoàn thành đúng một thay đổi comment trong một file, lint và test mục
  tiêu đạt. Thời gian khoảng 4 phút; phần lớn context ban đầu bị lãng phí vì
  prompt cũ yêu cầu đọc toàn bộ `CLAUDE.md`. Quy tắc hiện tại đã bỏ cách này.
- Heavy 32K dùng khoảng 18 GB RAM/GPU memory khi chạy. Một audit năm file bị
  compact context rồi đọc lại từ đầu, nên không đạt.
- Heavy hoàn thành một task test tập trung trên hai file trong khoảng 6 phút,
  chỉ sửa đúng file cho phép; test 8/8 và ESLint đạt. Tuy nhiên model dùng
  `role as Role`, vi phạm tiêu chí không dùng type cast để che kiểu dữ liệu.

Kết luận vận hành: local model phù hợp để tạo bản nháp triển khai có phạm vi
chặt và giảm token cloud cho việc đọc/sửa lặp lại. Claude/Codex vẫn phải review
diff theo acceptance criteria. Với thay đổi rất nhỏ, tự sửa có thể nhanh hơn
thời gian nạp khoảng 16K token nền của OpenCode; chỉ giao local khi lượng công
việc triển khai đủ lớn để bù chi phí khởi động đó.
