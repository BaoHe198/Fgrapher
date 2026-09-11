// Prompt B8, VIỆC 2 — CLAUDE.md mục 10: tiền VND định dạng "1.500.000₫",
// ngày dd/MM/yyyy, giờ HH:mm, múi giờ Asia/Ho_Chi_Minh cho mọi hiển thị.
// Nguồn sự thật duy nhất cho mọi định dạng tiền/ngày hiển thị cho người
// dùng — không dùng toLocaleString()/toLocaleDateString() trực tiếp ở nơi
// khác, vì chúng phụ thuộc locale/múi giờ mặc định của môi trường chạy
// (khác nhau giữa máy dev, server Vercel, và trình duyệt người dùng).

const HCM_TIME_ZONE = "Asia/Ho_Chi_Minh";

function toDate(value: Date | string | number) {
  return value instanceof Date ? value : new Date(value);
}

// "1.500.000₫" — dấu chấm ngăn cách hàng nghìn, không khoảng trắng trước ₫.
export function formatVND(amount: number) {
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(amount))}₫`;
}

// "1.234" — plain integer counts (dashboard stat cards etc.), not a
// currency amount. vi-VN grouping uses "." as the thousands separator,
// unlike the "," a bare Number.prototype.toLocaleString() defaults to
// under the server/browser's own locale.
export function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

// "2" / "1,5" — Service.duration is stored in MINUTES, but a shoot length is
// always shown to the user in HOURS. Every screen used to decide for itself:
// the profile's services tab showed "2 giờ" while the booking wizard's
// package picker showed "120 phút" for the very same service, and the
// date step said "Thời lượng: 120 phút". This is the one place minutes
// become hours, so they can't drift apart again.
//
// Fractions are real (a 90-minute package is 1,5 giờ), so one decimal is
// kept and a whole number never shows a trailing ",0". vi-VN throughout,
// same deliberate choice as every other formatter in this file.
export function formatDurationHours(minutes: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(
    minutes / 60,
  );
}

// "05/03/2026"
export function formatDate(value: Date | string | number) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: HCM_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(toDate(value));
}

// "14:30 05/03/2026"
export function formatDateTime(value: Date | string | number) {
  const date = toDate(value);
  const time = new Intl.DateTimeFormat("vi-VN", {
    timeZone: HCM_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${time} ${formatDate(date)}`;
}

// "14:30"
export function formatTime(value: Date | string | number) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: HCM_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(toDate(value));
}

// "tháng 9 năm 2026" — calendar-header granularity, not a full date.
export function formatMonthYear(value: Date | string | number) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: HCM_TIME_ZONE,
    month: "long",
    year: "numeric",
  }).format(toDate(value));
}

// "CN" / "T2" / "T3"... — day-of-week abbreviation for a calendar grid.
export function formatWeekdayShort(value: Date | string | number) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: HCM_TIME_ZONE,
    weekday: "short",
  }).format(toDate(value));
}

// "Chủ Nhật, 13 tháng 9" — long-form, no year (matches how a single
// upcoming booking date reads more naturally than the numeric dd/MM/yyyy
// form used everywhere else).
export function formatDateLong(value: Date | string | number) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: HCM_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(toDate(value));
}

// "13 thg 9" — compact day+month, no year/weekday (dropdown option labels).
export function formatDayMonth(value: Date | string | number) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: HCM_TIME_ZONE,
    day: "numeric",
    month: "short",
  }).format(toDate(value));
}

// "CN, 13 thg 9" — compact weekday+day+month, no year (list-row labels).
export function formatWeekdayDayMonth(value: Date | string | number) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: HCM_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(toDate(value));
}

// "13 tháng 9" — day + full month, no year/weekday (chat date separators).
export function formatDayMonthLong(value: Date | string | number) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: HCM_TIME_ZONE,
    day: "numeric",
    month: "long",
  }).format(toDate(value));
}
