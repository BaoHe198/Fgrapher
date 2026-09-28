import { Switch } from "fgrapher";

const noop = () => {};

const rows = [
  { label: "Email khi có yêu cầu đặt lịch mới", hint: "Gửi tới minhanh.photo@gmail.com", on: true },
  { label: "Nhắc lịch chụp trước 24 giờ", hint: "Qua email và thông báo trong ứng dụng", on: true },
  { label: "Bản tin ưu đãi hằng tháng", hint: "Tối đa 1 email mỗi tháng", on: false },
];

// Settings rows put the text on the left and a bare switch on the right, the
// way /dashboard/settings lays them out.
export const NotificationSettings = () => (
  <div className="flex w-[420px] flex-col divide-y divide-border-subtle rounded-[var(--fg-radius-lg)] border border-border-default bg-bg-surface">
    {rows.map((row) => (
      <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex flex-col">
          <span className="text-body-md text-text-primary">{row.label}</span>
          <span className="text-body-sm text-text-tertiary">{row.hint}</span>
        </div>
        <Switch aria-label={row.label} checked={row.on} onChange={noop} />
      </div>
    ))}
  </div>
);

export const States = () => (
  <div className="flex flex-col items-start gap-4">
    <Switch label="Tắt" checked={false} onChange={noop} />
    <Switch label="Bật" checked onChange={noop} />
    <Switch label="Nhận việc toàn quốc (tắt, bị khóa)" checked={false} disabled onChange={noop} />
    <Switch label="Hồ sơ công khai (bật, bị khóa)" checked disabled onChange={noop} />
  </div>
);

export const Bare = () => (
  <div className="flex items-center gap-4">
    <Switch aria-label="Đang nhận lịch" checked onChange={noop} />
    <Switch aria-label="Tạm nghỉ" checked={false} onChange={noop} />
  </div>
);
