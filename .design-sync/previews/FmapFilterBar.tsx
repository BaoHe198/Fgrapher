import { FmapFilterBar } from "fgrapher";

const noop = () => {};

const base = {
  provinceId: "",
  wardId: "",
  date: "2026-10-12",
  start: "08:00",
  end: "11:30",
  role: "PHOTOGRAPHER" as const,
  category: "WEDDING" as const,
};

export const Ready = () => (
  <FmapFilterBar
    value={base}
    onChange={noop}
    onSearch={noop}
    onUseLocation={noop}
    isLoading={false}
    invalidReason={null}
    expanded
    onExpandedChange={noop}
  />
);

export const Searching = () => (
  <FmapFilterBar
    value={{ ...base, role: "MAKEUP_ARTIST", category: "BRIDAL", start: "05:00", end: "07:30" }}
    onChange={noop}
    onSearch={noop}
    onUseLocation={noop}
    isLoading
    invalidReason={null}
    expanded
    onExpandedChange={noop}
  />
);

export const InvalidTime = () => (
  <FmapFilterBar
    value={{ ...base, role: "STUDIO", category: "", start: "15:00", end: "13:00" }}
    onChange={noop}
    onSearch={noop}
    onUseLocation={noop}
    isLoading={false}
    invalidReason="Giờ kết thúc phải sau giờ bắt đầu"
    expanded
    onExpandedChange={noop}
  />
);
