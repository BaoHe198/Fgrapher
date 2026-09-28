import { Badge, Tabs, TabsList, TabsPanel, TabsTab } from "fgrapher";

export const ProfileSections = () => (
  <Tabs defaultValue="services" className="w-full max-w-2xl">
    <TabsList>
      <TabsTab value="portfolio">Danh mục ảnh</TabsTab>
      <TabsTab value="services">Gói dịch vụ</TabsTab>
      <TabsTab value="reviews">Đánh giá (12)</TabsTab>
    </TabsList>
    <TabsPanel value="portfolio" className="py-4" />
    <TabsPanel value="services" className="flex flex-col gap-3 py-4">
      {[
        ["Chụp chân dung áo dài", "2 giờ · 30 ảnh chỉnh sửa", "1.500.000₫"],
        ["Ảnh cưới ngoại cảnh", "1 ngày · 120 ảnh chỉnh sửa", "8.500.000₫"],
      ].map(([name, meta, price]) => (
        <div
          key={name}
          className="flex items-center justify-between rounded-[var(--fg-radius-md)] border border-border-subtle bg-bg-surface p-4"
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-body-md font-semibold! text-text-primary">
              {name}
            </span>
            <span className="text-body-sm text-text-tertiary">{meta}</span>
          </div>
          <span className="text-body-md font-semibold! text-text-primary">
            {price}
          </span>
        </div>
      ))}
    </TabsPanel>
    <TabsPanel value="reviews" className="py-4" />
  </Tabs>
);

export const BookingStatus = () => (
  <Tabs defaultValue="pending" className="w-full max-w-2xl">
    <TabsList>
      <TabsTab value="pending">Chờ xác nhận</TabsTab>
      <TabsTab value="confirmed">Đã xác nhận</TabsTab>
      <TabsTab value="completed">Đã hoàn thành</TabsTab>
      <TabsTab value="cancelled">Đã hủy</TabsTab>
    </TabsList>
    <TabsPanel value="pending" className="flex flex-col gap-2 py-4">
      {[
        ["Trần Thu Hà", "Chụp kỷ yếu · 18/10/2026"],
        ["Lê Quốc Bảo", "Chụp sự kiện · 25/10/2026"],
      ].map(([who, what]) => (
        <div
          key={who}
          className="flex items-center justify-between rounded-[var(--fg-radius-md)] bg-bg-sunken px-4 py-3"
        >
          <div className="flex flex-col">
            <span className="text-body-md font-semibold! text-text-primary">
              {who}
            </span>
            <span className="text-body-sm text-text-secondary">{what}</span>
          </div>
          <Badge variant="warning">Chờ xác nhận</Badge>
        </div>
      ))}
    </TabsPanel>
  </Tabs>
);

export const NotificationFilter = () => (
  <Tabs defaultValue="unread" className="w-full max-w-md">
    <TabsList>
      <TabsTab value="all">Tất cả</TabsTab>
      <TabsTab value="unread">Chưa đọc (4)</TabsTab>
    </TabsList>
    <TabsPanel value="unread" className="py-3">
      <p className="text-body-md text-text-secondary">
        Nguyễn Thảo Vy đã gửi yêu cầu đặt lịch chụp chân dung ngày 02/11/2026.
      </p>
    </TabsPanel>
  </Tabs>
);
