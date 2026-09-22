# Hướng dẫn cho coding agent

File này là điểm vào ngắn gọn cho Claude, Codex và local AI. Không dùng file
này để thay thế tài liệu kiến trúc chi tiết.

## Thứ tự đọc

1. `CLAUDE.md`: ràng buộc bắt buộc và quy ước code.
2. `docs/MVP_SCOPE.md`: phạm vi sản phẩm đang áp dụng.
3. `docs/FEATURES.md`: hành vi của tính năng.
4. `docs/ARCHITECTURE.md`: kiến trúc và luồng dữ liệu.
5. Tài liệu domain liên quan trong `docs/ops/` hoặc `docs/guides/`.
6. Code, schema và test hiện tại trước khi đưa ra kết luận.

Claude/Codex đọc tài liệu nền để lập task. Local worker không mở toàn bộ
`CLAUDE.md` hoặc tài liệu dài cho một thay đổi nhỏ; prompt phải cung cấp đúng
ràng buộc cần thiết, và worker chỉ tìm/đọc đoạn liên quan khi còn thiếu thông
tin.

Tài liệu trong `docs/guides/` và các báo cáo audit có mốc ngày có thể mô tả
trạng thái lịch sử. Nếu tài liệu mâu thuẫn nhau, kiểm tra code hiện tại và quyết
định mới nhất của chủ dự án; không tự chọn giả định thuận tiện nhất.

## Quy trình bắt buộc

Mọi task phải đi theo thứ tự:

```text
READ → UNDERSTAND → PLAN → IMPLEMENT → VALIDATE → REPORT
```

Trước khi sửa, nêu ngắn gọn:

- mục tiêu;
- file đã xem và file dự kiến thay đổi;
- dependency và quy tắc nghiệp vụ liên quan;
- kế hoạch triển khai và validation.

Sau khi sửa, báo cáo:

- file đã thay đổi và lý do;
- test, typecheck, lint hoặc build đã chạy;
- lỗi còn lại, rủi ro và việc chưa hoàn thành.

Không sửa file ngoài phạm vi. Không suy đoán schema hoặc permission. Khi
validation thất bại, dừng thay đổi không liên quan, xác định lỗi có do task hiện
tại gây ra hay không, sửa trong phạm vi rồi chạy lại. Nếu cần mở rộng phạm vi,
báo lại Claude/Codex.

## Local AI worker

Chi tiết vận hành nằm tại `docs/ops/local-ai-worker.md`.

- `daily`: thay đổi nhỏ trong 1–3 file, UI, TypeScript, validation, test và tài
  liệu.
- `heavy`: schema, migration, quyền truy cập, kiến trúc hoặc debug cần suy luận
  sâu. Heavy vẫn phải là task tập trung; không mặc định dùng chỉ vì có nhiều
  file.
- Claude/Codex chịu trách nhiệm chia task, chọn profile, review diff và xác nhận
  kết quả cuối.
- Local AI chỉ triển khai trong worktree riêng và sạch. Nó không được commit,
  push, deploy hoặc chạy migration production.

Không giao một yêu cầu kiểu “refactor toàn bộ hệ thống”. Hãy chia thành audit
không sửa code, thiết kế, từng bước triển khai độc lập và regression test.
Nếu cần hiểu hơn ba file lớn, Claude/Codex phải tự trích symbol và đoạn code liên
quan hoặc chia thành nhiều lượt trước khi giao Heavy.
