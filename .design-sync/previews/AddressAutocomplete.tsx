import { AddressAutocomplete } from "fgrapher";

const noop = () => {};
const areaNames = ["Thành phố Hồ Chí Minh", "Phường Thủ Đức"];

export const Empty = () => (
  <div className="w-[420px]">
    <AddressAutocomplete
      label="Địa chỉ chi tiết"
      placeholder="Số nhà, tên đường (VD: 12 Võ Văn Ngân)"
      value=""
      point={null}
      provinceId="p-hcm"
      wardId="w-thuduc"
      areaNames={areaNames}
      onChange={noop}
    />
  </div>
);

export const TypedNotPinned = () => (
  <div className="w-[420px]">
    <AddressAutocomplete
      label="Địa chỉ chi tiết"
      placeholder="Số nhà, tên đường (VD: 12 Võ Văn Ngân)"
      value="134/5B Võ Văn Ngân"
      point={null}
      provinceId="p-hcm"
      wardId="w-thuduc"
      areaNames={areaNames}
      onChange={noop}
    />
  </div>
);

export const Pinned = () => (
  <div className="w-[420px]">
    <AddressAutocomplete
      label="Địa chỉ chi tiết"
      placeholder="Số nhà, tên đường (VD: 12 Võ Văn Ngân)"
      value="12 Võ Văn Ngân"
      point={{ latitude: 10.8506, longitude: 106.7719 }}
      provinceId="p-hcm"
      wardId="w-thuduc"
      areaNames={areaNames}
      onChange={noop}
    />
  </div>
);
