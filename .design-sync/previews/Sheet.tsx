import {
  Button,
  Checkbox,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "fgrapher";

export const FilterPanel = () => (
  <Sheet open>
    <SheetContent side="right" initialFocus={false}>
      <SheetHeader>
        <SheetTitle>Bộ lọc tìm kiếm</SheetTitle>
        <SheetDescription>
          Thu hẹp danh sách nhiếp ảnh gia tại Thành phố Hồ Chí Minh.
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-5 px-4">
        <div className="flex flex-col gap-3">
          <p className="text-body-sm font-semibold! text-text-primary">
            Thể loại
          </p>
          {["Ảnh cưới", "Chân dung", "Kỷ yếu", "Sự kiện"].map((label, i) => (
            <label
              key={label}
              className="flex items-center gap-2 text-body-md text-text-secondary"
            >
              <Checkbox defaultChecked={i < 2} />
              {label}
            </label>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-body-sm font-semibold! text-text-primary">
            Mức giá
          </p>
          <p className="text-body-md text-text-secondary">
            1.500.000₫ – 5.000.000₫
          </p>
        </div>
      </div>
      <SheetFooter>
        <Button variant="accent">Xem 24 kết quả</Button>
        <Button variant="ghost">Xóa bộ lọc</Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
);

export const MobileMenu = () => (
  <Sheet open>
    <SheetContent side="left" initialFocus={false}>
      <SheetHeader>
        <SheetTitle>Fgrapher</SheetTitle>
        <SheetDescription>Xin chào, Minh Anh</SheetDescription>
      </SheetHeader>
      <nav className="flex flex-col px-2">
        {[
          "Khám phá",
          "Tìm nhiếp ảnh gia",
          "Lịch đặt của tôi",
          "Tin nhắn",
          "Cài đặt tài khoản",
        ].map((item, i) => (
          <a
            key={item}
            href="#"
            className={
              i === 2
                ? "rounded-md bg-bg-sunken px-3 py-2.5 text-body-md font-semibold! text-text-primary"
                : "rounded-md px-3 py-2.5 text-body-md text-text-secondary"
            }
          >
            {item}
          </a>
        ))}
      </nav>
    </SheetContent>
  </Sheet>
);

export const BookingSummaryBottom = () => (
  <Sheet open>
    <SheetContent side="bottom" initialFocus={false}>
      <SheetHeader>
        <SheetTitle>Gói chụp ảnh cưới ngoại cảnh</SheetTitle>
        <SheetDescription>
          Ngày 12/10/2026 · Phường Thủ Đức, Thành phố Hồ Chí Minh
        </SheetDescription>
      </SheetHeader>
      <div className="flex items-center justify-between px-4">
        <span className="text-body-md text-text-secondary">Tổng chi phí</span>
        <span className="text-heading-md text-text-primary">8.500.000₫</span>
      </div>
      <SheetFooter>
        <Button variant="accent">Gửi yêu cầu đặt lịch</Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
);
