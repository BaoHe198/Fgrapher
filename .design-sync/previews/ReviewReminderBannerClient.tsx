import { ReviewReminderBannerClient } from "fgrapher";

export const SingleBooking = () => (
  <ReviewReminderBannerClient
    message="Bạn có 1 buổi chụp đã hoàn thành chưa đánh giá, gần đây nhất với Minh Anh Nhiếp Ảnh."
    ctaLabel="Đánh giá ngay"
    dismissLabel="Để sau"
    ctaHref="/dashboard/bookings"
  />
);

export const SeveralBookings = () => (
  <ReviewReminderBannerClient
    message="Bạn có 3 buổi chụp đã hoàn thành chưa đánh giá, gần đây nhất với Studio Nắng Sài Gòn."
    ctaLabel="Đánh giá ngay"
    dismissLabel="Để sau"
    ctaHref="/dashboard/bookings"
  />
);

export const AboveDashboard = () => (
  <div className="bg-bg-page">
    <ReviewReminderBannerClient
      message="Bạn có 2 buổi chụp đã hoàn thành chưa đánh giá, gần đây nhất với Ngọc Linh Makeup."
      ctaLabel="Đánh giá ngay"
      dismissLabel="Để sau"
      ctaHref="/dashboard/bookings"
    />
    <div className="flex flex-col gap-2 px-8 py-8">
      <h1 className="text-heading-xl text-text-primary">Lịch đặt của tôi</h1>
      <p className="text-body-md text-text-secondary">
        2 buổi sắp tới · 5 buổi đã hoàn thành
      </p>
    </div>
  </div>
);
