# Bản đồ tài liệu Fgrapher

Nếu mới làm quen dự án, hãy đọc theo thứ tự này:

1. `ops/CAM-NANG-KIEN-THUC-IT-FGRAPHER.md`: học thuật ngữ và bức tranh tổng thể.
2. `MVP_SCOPE.md`: biết phần nào đang bật/tắt.
3. `FEATURES.md`: hiểu hành vi sản phẩm.
4. `ARCHITECTURE.md`: hiểu code và dữ liệu đi qua đâu.
5. `DEVELOPMENT.md`: chạy và thay đổi dự án.
6. `ops/VAN-HANH-PRODUCTION.md`: vận hành website thật.

## Tài liệu hiện hành

| File                   | Dùng khi nào?                                       |
| ---------------------- | --------------------------------------------------- |
| `ARCHITECTURE.md`      | Cần hiểu cấu trúc hệ thống                          |
| `FEATURES.md`          | Cần biết sản phẩm đang làm gì                       |
| `MVP_SCOPE.md`         | Cần quyết định tính năng đang bật hay ngoài phạm vi |
| `DEVELOPMENT.md`       | Cài local, sửa code, test                           |
| `ENVIRONMENTS.md`      | Phân biệt local, Preview và production              |
| `MIGRATIONS.md`        | Thay đổi database                                   |
| `OPERATIONS.md`        | Vận hành hằng ngày và sự cố                         |
| `PRE_LAUNCH_REVIEW.md` | Xem lần rà soát trước launch                        |
| `REVIEW-2026-09-08.md` | Xem audit có mốc ngày cụ thể                        |

Hướng dẫn giao task cho AI chạy trên máy nằm tại
`ops/local-ai-worker.md`. Coding agent bắt đầu từ `../AGENTS.md` để biết thứ tự
đọc tài liệu và giới hạn quyền.

## Thư mục

### `ops/`

Runbook chuyên sâu cho production: email, verification, moderation, polling, thông báo,
checklist thủ công và cẩm nang IT.

### `guides/`

Kế hoạch/prompt lịch sử từng dùng để xây dự án. Dùng để hiểu ý định, không dùng làm
nguồn hiện trạng nếu mâu thuẫn với code hoặc tài liệu hiện hành.

### `design-reference/`

UI Kit gốc và design token. File HTML là bản xuất tự động; file Markdown giải thích
cách token được dùng.

### `i18n-batches/`

Các JSON trung gian cho bản dịch ứng dụng. Đây là dữ liệu i18n, không phải tài liệu
đọc. File `.en.json` cần giữ tiếng Anh; file `.vi.json` giữ tiếng Việt.

### `_prelaunch-audit-*.md`

Báo cáo lịch sử tại thời điểm audit. Chúng lưu phát hiện và phương pháp, không khẳng
định lỗi hiện vẫn tồn tại.

## Quy tắc duy trì tài liệu

- Viết giải thích bằng tiếng Việt; giữ nguyên tên code, API, biến và lệnh.
- Giải thích thuật ngữ lần đầu xuất hiện hoặc link tới cẩm nang.
- Ghi rõ “lịch sử” và mốc thời gian cho báo cáo cũ.
- Không ghi số lượng test cố định vì sẽ nhanh lỗi thời.
- Cập nhật tài liệu trong cùng thay đổi làm đổi kiến trúc/vận hành.
- Khi tài liệu và code mâu thuẫn, kiểm tra code/test rồi sửa tài liệu.
- Không đưa secret, token, dữ liệu cá nhân hoặc URL signed vào tài liệu.
