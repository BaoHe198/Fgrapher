# Fgrapher — Đợt công việc bổ sung đã dùng trong quá trình phát triển

> Tài liệu lịch sử. Các prompt tiếng Anh dài trước đây đã được rút thành mục tiêu,
> yêu cầu và cách kiểm tra bằng tiếng Việt. Hãy xem code hiện tại để biết kết quả cuối
> cùng.

## 1. Gộp “Đăng nhập” và “Bắt đầu”

### Vấn đề

Navigation từng có hai nút cho khách chưa đăng nhập, làm người dùng khó hiểu. Mục tiêu
là một điểm vào `/login`, sau đó đổi giữa tab đăng nhập/đăng ký.

### Yêu cầu

- Desktop và mobile có một nút `Đăng nhập / Đăng ký`.
- `/login?mode=register` mở đúng tab.
- `/register` cũ redirect và giữ `role`/callback an toàn.
- Chuyển tab không remount phần minh hoạ không cần thiết.
- Login/register giữ validation, social auth, loading/error.
- Footer trong form đổi tab thay vì điều hướng vòng.
- Cập nhật cả message Việt/Anh.

### Kiểm tra

Mở từ navigation, đổi tab, chọn Creative pro/role và đăng ký; refresh/back vẫn giữ
mode phù hợp.

## 2. Lỗi bộ lọc phải bấm nhiều lần

### Các nguyên nhân đã được yêu cầu kiểm tra

1. Debounce dùng nhầm cho checkbox/radio.
2. Input vừa controlled vừa có state nội bộ.
3. `router.push` làm remount và mất click đang chờ.
4. Label/hit area hoặc event handler sai.

### Hướng giải quyết

- Debounce chỉ ô text.
- Discrete filter cập nhật optimistic state ngay.
- Batch nhiều click nhanh thành một navigation nhưng không mất lựa chọn.
- URL vẫn là trạng thái chia sẻ/khôi phục được.
- `useTransition` báo loading mà không khoá sidebar.
- Label gắn đúng input và vùng chạm đủ lớn.
- Response/navigation cũ không ghi đè state mới.

### Kiểm tra

- mỗi checkbox/radio nhận từ click đầu;
- click nhanh ba role giữ cả ba;
- click label giống click box;
- city/budget/reset hoạt động;
- back button khôi phục;
- thử trên thiết bị cảm ứng thật.

## 3. Thêm vai trò Model

Đây là thay đổi xuyên suốt nhiều lớp.

### 3.1 Dữ liệu và quyền

- Thêm `MODEL` vào enum và migration.
- Thêm field profile phù hợp như chiều cao, số đo, tóc/mắt/cỡ giày, kinh nghiệm và
  sẵn sàng di chuyển.
- Cập nhật role constants, label, slug, pricing/plan và permission mapping.
- Quy định ai được booking Model.
- Cập nhật seed và compiler mapping `Record<Role, ...>`.

### 3.2 Tuổi và an toàn

- Mọi tài khoản ≥18, gồm credentials và OAuth.
- Không hiển thị ngày sinh chính xác; chỉ nhóm tuổi khi cần.
- Model cần verification trước publish.
- KYC non-public, signed URL ngắn, audit mỗi lần admin xem và retention.
- Category không bao gồm nội dung người lớn theo ràng buộc dự án.
- Contact/address chỉ mở theo policy booking.

### 3.3 Giao diện

- Registration/role picker.
- Onboarding và profile editor field riêng.
- Browse/search filter và card.
- Public profile.
- Booking, messaging, review và admin.
- Chuỗi `Người mẫu`, `Chiều cao`, `Kinh nghiệm`, `Sẵn sàng di chuyển` trong
  i18n.

### Kiểm tra

Đăng ký Model, hoàn tất age/consent/KYC, tạo profile/media, publish, tìm kiếm và được
Photographer/Videographer booking theo policy.

## 4. Xây bộ tài liệu bảo trì

Đợt này yêu cầu tạo:

- `docs/ARCHITECTURE.md`: kiến trúc, data model, auth, tích hợp và convention.
- `docs/FEATURES.md`: đặc tả hành vi, role và business rule.
- `docs/OPERATIONS.md`: vận hành, incident, database và support.
- `docs/DEVELOPMENT.md`: setup, workflow, test, migration và debug.

Các tài liệu ban đầu do code snapshot lúc đó sinh ra nên nhanh chóng lỗi thời. Quy tắc
duy trì mới:

1. mô tả hành vi cuối, không giữ dự đoán;
2. ghi ngày/trạng thái cho báo cáo audit;
3. link đến file nguồn;
4. không ghi số test cố định;
5. cập nhật docs trong cùng thay đổi làm đổi vận hành/kiến trúc;
6. viết tiếng Việt, giải thích thuật ngữ cho người mới.

## Thứ tự đã được đề xuất

1. Gộp điểm vào auth.
2. Sửa filter.
3. Ghi tài liệu mốc trước Model.
4. Thêm Model qua data → safety → UI.
5. Cập nhật tài liệu sau cùng.

Hiện các việc này đã đi qua nhiều vòng sửa tiếp theo. Không chạy lại nguyên batch;
tạo issue nhỏ từ trạng thái code hiện tại.
