import { BookingSummary } from "fgrapher";

export const Editable = () => (
  <div className="w-[380px]">
    <BookingSummary
      provider={{ name: "Minh Anh Nhiếp Ảnh", rating: 4.9, reviewCount: 128, verified: true }}
      rows={[
        { label: "Gói", value: "Ảnh cưới ngoại cảnh", onEdit: () => {} },
        { label: "Ngày", value: "12/10/2026", onEdit: () => {} },
        { label: "Giờ", value: "06:00", sub: "Giờ vàng", onEdit: () => {} },
        { label: "Địa điểm", value: null, onEdit: () => {} },
        { label: "Tham khảo", value: "2 ảnh tham khảo", onEdit: () => {} },
      ]}
      total="5.500.000₫"
      totalNote="Giá cuối cùng chốt khi nghệ sĩ xác nhận"
      responseNote="Nghệ sĩ phản hồi trong 2 giờ"
    />
  </div>
);

export const QuoteLater = () => (
  <div className="w-[380px]">
    <BookingSummary
      provider={{ name: "Đức Thịnh Creative Studio" }}
      rows={[{ label: "Gói", value: "Tùy chỉnh" }, { label: "Ngày", value: "03/10/2026" }]}
      total={null}
      editable={false}
      responseNote="Nghệ sĩ phản hồi trong 48 giờ"
    />
  </div>
);
