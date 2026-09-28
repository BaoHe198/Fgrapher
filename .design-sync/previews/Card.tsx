import { Badge, Button, Card, CardDescription, CardTitle } from "fgrapher";

const photo = (from: string, to: string, label: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='640' height='360' fill='url(#g)'/><text x='32' y='330' font-family='sans-serif' font-size='24' fill='rgba(255,255,255,0.7)'>${label}</text></svg>`,
  )}`;

export const BookingSummary = () => (
  <div className="max-w-sm">
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>Gói chụp ảnh cưới ngoại cảnh</CardTitle>
          <CardDescription>Minh Anh Nhiếp Ảnh · 12/10/2026</CardDescription>
        </div>
        <Badge variant="warning">Chờ xác nhận</Badge>
      </div>
      <dl className="grid grid-cols-2 gap-y-2 text-body-sm">
        <dt className="text-text-secondary">Địa điểm</dt>
        <dd className="text-right">Phường Thủ Đức, TP.HCM</dd>
        <dt className="text-text-secondary">Thời lượng</dt>
        <dd className="text-right">4 giờ</dd>
        <dt className="text-text-secondary">Tổng tiền</dt>
        <dd className="text-right font-semibold">5.500.000₫</dd>
      </dl>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm">
          Nhắn tin
        </Button>
        <Button size="sm">Xem chi tiết</Button>
      </div>
    </Card>
  </div>
);

export const Interactive = () => (
  <div className="max-w-xs">
    <Card interactive padding={false}>
      <img
        src={photo("#0f3d33", "#c9a24d", "Studio Ánh Sáng")}
        alt=""
        className="aspect-video w-full object-cover"
      />
      <div className="flex flex-col gap-1 p-4">
        <CardTitle>Studio Ánh Sáng</CardTitle>
        <CardDescription>Phường Bến Thành, Thành phố Hồ Chí Minh</CardDescription>
        <p className="mt-2 text-body-md font-semibold">Từ 350.000₫/giờ</p>
      </div>
    </Card>
  </div>
);

export const GuideSection = () => (
  <div className="max-w-md">
    <Card className="flex flex-col gap-2">
      <h3 className="flex items-baseline gap-2 text-heading-md text-text-primary">
        <span className="text-body-sm font-semibold! text-brand-primary">1.</span>
        Gửi yêu cầu đặt lịch
      </h3>
      <ul className="flex flex-col gap-2 pl-6 text-body-md text-text-secondary [&>li]:list-disc">
        <li>Chọn gói dịch vụ và ngày chụp trên lịch của nhiếp ảnh gia.</li>
        <li>Ghi chú địa điểm, số người và phong cách mong muốn.</li>
        <li>Chờ nhiếp ảnh gia xác nhận trong vòng 24 giờ.</li>
      </ul>
    </Card>
  </div>
);

export const Small = () => (
  <div className="w-64">
    <Card size="sm" className="flex flex-col gap-1">
      <CardDescription>Lượt xem hồ sơ · 30 ngày qua</CardDescription>
      <p className="text-heading-md font-semibold text-text-primary">1.248</p>
    </Card>
  </div>
);
