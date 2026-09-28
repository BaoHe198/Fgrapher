import { DateField } from "fgrapher";

const noop = () => {};

export const Filled = () => (
  <div className="w-[320px]">
    <DateField label="Ngày chụp" value="2026-10-12" onChange={noop} />
  </div>
);

export const Empty = () => (
  <div className="w-[320px]">
    <DateField label="Ngày sinh" value="" onChange={noop} />
  </div>
);

export const WithError = () => (
  <div className="w-[320px]">
    <DateField
      label="Ngày sinh"
      value="2010-03-15"
      onChange={noop}
      error="Bạn cần từ đủ 18 tuổi để tạo tài khoản."
    />
  </div>
);

export const Disabled = () => (
  <div className="w-[320px]">
    <DateField
      label="Ngày đặt lịch"
      value="2026-09-28"
      onChange={noop}
      disabled
    />
  </div>
);

export const Range = () => (
  <div className="flex w-[520px] gap-3">
    <DateField className="flex-1" label="Ngày nhận trang phục" value="2026-10-10" onChange={noop} />
    <DateField className="flex-1" label="Ngày trả" value="2026-10-13" onChange={noop} />
  </div>
);
