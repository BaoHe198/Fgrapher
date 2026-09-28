import { CurrencyInput } from "fgrapher";

const noop = () => {};

export const Filled = () => (
  <div className="w-[320px]">
    <CurrencyInput label="Giá gói chụp" value="1500000" onChange={noop} />
  </div>
);

export const Empty = () => (
  <div className="w-[320px]">
    <CurrencyInput
      label="Tiền cọc trang phục"
      value=""
      onChange={noop}
      placeholder="Ví dụ: 500.000"
    />
  </div>
);

export const WithError = () => (
  <div className="w-[320px]">
    <CurrencyInput
      label="Giá thuê theo ngày"
      value="5000"
      onChange={noop}
      error="Giá thuê tối thiểu là 10.000₫."
    />
  </div>
);

export const Disabled = () => (
  <div className="w-[320px]">
    <CurrencyInput
      label="Tổng tạm tính"
      value="12800000"
      onChange={noop}
      disabled
    />
  </div>
);

export const PriceRange = () => (
  <div className="flex w-[440px] items-end gap-3">
    <div className="flex-1">
      <CurrencyInput label="Giá từ" value="1000000" onChange={noop} />
    </div>
    <span className="pb-3 text-text-tertiary">–</span>
    <div className="flex-1">
      <CurrencyInput label="Đến" value="8000000" onChange={noop} />
    </div>
  </div>
);
