import { NativeSelect } from "fgrapher";

const provinces = [
  { value: "", label: "Chọn tỉnh/thành" },
  { value: "hcm", label: "Thành phố Hồ Chí Minh" },
  { value: "hn", label: "Thành phố Hà Nội" },
  { value: "dn", label: "Thành phố Đà Nẵng" },
  { value: "ld", label: "Tỉnh Lâm Đồng" },
];

const noop = () => {};

export const Province = () => (
  <div className="w-[360px]">
    <NativeSelect
      label="Tỉnh/thành phố"
      options={provinces}
      value="hcm"
      onChange={noop}
    />
  </div>
);

export const Placeholder = () => (
  <div className="w-[360px]">
    <NativeSelect
      label="Loại dịch vụ"
      options={[
        "Chọn loại dịch vụ",
        "Chụp ảnh cưới",
        "Chụp kỷ yếu",
        "Chụp chân dung",
        "Quay phim sự kiện",
      ]}
      value="Chọn loại dịch vụ"
      onChange={noop}
    />
  </div>
);

export const WithError = () => (
  <div className="w-[360px]">
    <NativeSelect
      label="Khu vực nhận việc"
      options={provinces}
      value=""
      onChange={noop}
      error="Vui lòng chọn tỉnh/thành bạn nhận việc."
    />
  </div>
);

export const Disabled = () => (
  <div className="w-[360px]">
    <NativeSelect
      label="Vai trò"
      options={["Nhiếp ảnh gia", "Quay phim", "Chuyên viên trang điểm"]}
      value="Nhiếp ảnh gia"
      onChange={noop}
      disabled
    />
  </div>
);
