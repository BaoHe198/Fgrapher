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
