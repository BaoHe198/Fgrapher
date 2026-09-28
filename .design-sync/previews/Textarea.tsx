import { Textarea } from "fgrapher";

// Textarea has no label/error props; call sites compose them around it with
// the same classes Input uses, so the previews do too.
const labelCls = "text-body-sm font-semibold! text-text-primary";

export const BookingNote = () => (
  <div className="flex w-[400px] flex-col gap-1.5">
    <label className={labelCls}>Lời nhắn cho nhiếp ảnh gia</label>
    <Textarea
      rows={4}
      defaultValue="Chào anh, bọn em muốn chụp ảnh cưới ngoại cảnh ở Đà Lạt ngày 12/10/2026, khoảng 6 tiếng, có cả trang điểm cô dâu. Anh báo giá giúp em nhé!"
    />
    <p className="text-body-sm text-text-tertiary">
      Tối đa 1.000 ký tự.
    </p>
  </div>
);

export const Empty = () => (
  <div className="flex w-[400px] flex-col gap-1.5">
    <label className={labelCls}>Giới thiệu bản thân</label>
    <Textarea
      rows={4}
      placeholder="Kể ngắn về phong cách chụp, kinh nghiệm và khu vực bạn nhận việc…"
    />
  </div>
);

export const WithError = () => (
  <div className="flex w-[400px] flex-col gap-1.5">
    <label className={labelCls}>Lý do báo cáo</label>
    <Textarea rows={3} aria-invalid defaultValue="Ảnh" />
    <p className="text-body-sm text-danger">
      Vui lòng mô tả chi tiết hơn (ít nhất 20 ký tự).
    </p>
  </div>
);

export const Disabled = () => (
  <div className="flex w-[400px] flex-col gap-1.5">
    <label className={labelCls}>Phản hồi của nhà cung cấp</label>
    <Textarea
      rows={3}
      disabled
      defaultValue="Cảm ơn chị đã tin tưởng Minh Anh Studio, hẹn gặp lại chị mùa cưới năm sau!"
    />
  </div>
);
