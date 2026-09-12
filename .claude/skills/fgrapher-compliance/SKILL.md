---
name: fgrapher-compliance
description: Quy tắc tuân thủ pháp lý Việt Nam bắt buộc cho Fgrapher (KYC, dữ liệu cá nhân, consent, kiểm duyệt nội dung). BẮT BUỘC dùng skill này mỗi khi đụng tới bất kỳ thứ gì liên quan tới User, Profile, ProfileMedia, Consent, KYC, Booking, upload ảnh, đăng ký tài khoản, xoá tài khoản, xuất dữ liệu, hoặc bất kỳ migration Prisma nào chạm vào dữ liệu cá nhân — kể cả khi người dùng không nhắc tới "pháp lý", "compliance" hay "KYC". Cũng dùng khi review PR, thiết kế API mới, hoặc khi được hỏi "có cần gì thêm không" về các module trên.
---

# Fgrapher — Tuân thủ pháp lý Việt Nam

Fgrapher là sàn giao dịch TMĐT có người bán (photographer, videographer, MUA, model, studio).
Điều đó kích hoạt ba nhóm nghĩa vụ **ngay từ lần đăng ký đầu tiên**, không phải sau khi launch.

## Nguồn sự thật

Văn bản gốc nằm ở `docs/legal/` trong repo này. **Luôn đọc file ở đó trước khi
trích dẫn số hiệu điều luật.** Skill này mô tả _quy tắc vận hành_ đã chốt, không
thay thế văn bản pháp lý. Nếu `docs/legal/` chưa tồn tại, báo cho người dùng biết
và đừng bịa số hiệu điều khoản.

Khung tham chiếu đang áp dụng:

- Luật Thương mại điện tử 122/2025 — nghĩa vụ KYC người bán
- Luật Bảo vệ dữ liệu cá nhân 91/2025 + Nghị định 356/2025 — consent, quyền chủ thể dữ liệu
- Bộ luật Dân sự Điều 32 — quyền hình ảnh cá nhân
- Nghị định 53 về an ninh mạng — lưu trữ dữ liệu trong nước

## Quy tắc cứng — không được vi phạm

### 1. KYC áp dụng cho MỌI seller role

Sai lầm đã có trong codebase: KYC chỉ gắn cho role `MODEL`.

Đúng: bất kỳ user nào có role cho phép **nhận booking hoặc nhận tiền** đều phải
qua KYC — `PHOTOGRAPHER`, `VIDEOGRAPHER`, `MAKEUP_ARTIST`, `MODEL`, `STUDIO`.

Khi thêm role mới vào enum, mặc định coi là seller role trừ khi người dùng nói rõ
ngược lại. Hỏi lại nếu không chắc.

Kiểm tra mỗi khi đụng schema:

- [ ] Có `KycVerification` gắn với role, không phải gắn cứng vào `MODEL`
- [ ] Trạng thái KYC chặn được việc publish profile / nhận booking
- [ ] Không role nào bypass được

### 2. Consent phải tách theo mục đích

Một checkbox "Tôi đồng ý với Điều khoản" là **không hợp lệ**. Luật 91/2025 yêu cầu
consent riêng cho từng mục đích xử lý.

Mô hình tối thiểu:

```
ConsentRecord {
  userId
  purpose        // enum, KHÔNG phải string tự do
  granted        // boolean
  grantedAt
  revokedAt      // nullable — thu hồi phải lưu, không xoá bản ghi
  policyVersion  // phiên bản chính sách tại thời điểm đồng ý
  ipAddress
  userAgent
}
```

Các `purpose` tối thiểu: `ACCOUNT_OPERATION`, `KYC_VERIFICATION`,
`PORTFOLIO_PUBLIC_DISPLAY`, `MARKETING_EMAIL`, `THIRD_PARTY_EKYC_PROCESSING`.

Quy tắc:

- Thu hồi consent = ghi `revokedAt`, **không bao giờ hard-delete** bản ghi cũ
- Mỗi lần đổi chính sách → `policyVersion` mới → consent cũ không tự động kế thừa
- Không được bundle: bật/tắt marketing phải độc lập với đăng ký tài khoản

### 3. Ảnh có người nhận diện được cần consent riêng

Điều 32 BLDS: ảnh chân dung người khác đăng công khai cần sự đồng ý của người đó.

Với portfolio của photographer, người trong ảnh **không phải** user của Fgrapher.
Vì vậy:

- `ProfileMedia` phải có trường khai báo: ảnh có người nhận diện được hay không
- Nếu có → provider phải xác nhận đã có consent của người trong ảnh (lưu bản ghi
  xác nhận này, kèm timestamp)
- Có quy trình gỡ ảnh khi bị khiếu nại, và bản ghi xử lý khiếu nại

### 4. ProfileMedia phải có trạng thái kiểm duyệt

Kiến trúc đã chốt là pre-publication moderation. Nghĩa là:

```
ProfileMedia.moderationStatus: PENDING | APPROVED | REJECTED
```

- Mặc định `PENDING`. **Không bao giờ** default `APPROVED`.
- Chỉ ảnh `APPROVED` mới hiển thị công khai
- Lưu lý do reject và ai/cái gì reject (AI hay admin)
- Không có category nội dung khoả thân / người lớn — reject thẳng

### 5. Dữ liệu nhạy cảm không rời khỏi Việt Nam

Ảnh CCCD, ảnh selfie KYC, dữ liệu sinh trắc: chỉ gửi tới nhà cung cấp eKYC trong
nước (VNPT eKYC, FPT.AI). Không gửi sang Onfido/Sumsub/Persona.

Ảnh CCCD gốc: không lưu lâu hơn mức cần thiết. Lưu kết quả xác minh + hash, không
lưu vĩnh viễn ảnh gốc trừ khi có lý do rõ ràng và đã ghi vào chính sách.

### 6. Quyền của chủ thể dữ liệu phải có đường đi trong code

Mỗi quyền dưới đây cần một endpoint hoặc quy trình admin thật, không phải chỉ nằm
trong Privacy Policy:

- Truy cập / xuất dữ liệu cá nhân
- Chỉnh sửa
- Xoá tài khoản (và xử lý booking/hoá đơn còn ràng buộc — không xoá được thì phải
  giải thích được vì sao)
- Rút lại consent
- Phản đối xử lý dữ liệu

## Những gì KHÔNG thuộc MVP

Nếu thấy code liên quan tới các mục này, hãy cảnh báo người dùng thay vì sửa:

- **Stripe / thanh toán online** — doanh nghiệp đăng ký tại VN, Stripe không hoạt
  động. Để sau feature flag `PAYMENTS_ENABLED=false`, đừng xoá code.
- **Gear marketplace, social feed** — ngoài phạm vi MVP, để sau feature flag.
- **Giao file sản phẩm qua platform** — không có ở MVP.
- **Mô hình hoa hồng %** — bất khả thi khi chưa có hạ tầng thanh toán.

## Cách hành xử khi bị yêu cầu làm khác

Nếu một yêu cầu mâu thuẫn với quy tắc cứng ở trên (ví dụ: "cứ để ảnh hiển thị
luôn cho nhanh, kiểm duyệt sau"), **nói rõ rủi ro trước khi làm**, nêu đúng quy
tắc nào bị vi phạm và hậu quả thực tế. Người dùng có thể quyết định ghi đè — đó
là quyền của họ — nhưng quyết định đó phải là quyết định có thông tin.

## Checklist trước khi merge bất kỳ PR nào chạm dữ liệu cá nhân

- [ ] Có purpose consent tương ứng chưa?
- [ ] Seller role mới có bị bỏ sót KYC không?
- [ ] Media mới có `moderationStatus` mặc định `PENDING` không?
- [ ] Dữ liệu nhạy cảm có rời khỏi VN không?
- [ ] Có log audit cho hành động admin trên dữ liệu cá nhân không?
- [ ] Xoá tài khoản có xử lý được bản ghi này không?
