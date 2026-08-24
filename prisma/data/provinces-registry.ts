// Prompt B4, VIỆC 2 — sổ đăng ký tỉnh/thành cho seedGeography() trong
// prisma/seed.ts. Việt Nam có 34 đơn vị cấp tỉnh sau sáp nhập 2025; hiện
// mới có dữ liệu thật cho 1 (TP.HCM, do chủ dự án cung cấp trực tiếp — xem
// prisma/data/hcmc-wards.ts).
//
// KHÔNG tự bịa danh sách 33 tỉnh/thành còn lại hay danh sách phường/xã của
// chúng từ trí nhớ — đây là yêu cầu tường minh của Prompt B4. Chờ chủ dự án
// cung cấp nguồn chính thức cho từng tỉnh.
//
// Để thêm một tỉnh mới khi có dữ liệu:
//   1. Tạo file prisma/data/<slug>-wards.ts theo đúng khuôn của
//      prisma/data/hcmc-wards.ts: export một hằng số PROVINCE dạng
//      { code: string; name: string } (code là slug, không phải mã số GSO
//      — xem comment trong hcmc-wards.ts) và một mảng WARDS: string[] theo
//      đúng thứ tự STT gốc từ nguồn (thứ tự này sinh ra Ward.code, xem
//      seedGeography()).
//   2. Import cặp đó và thêm một entry vào mảng PROVINCE_REGISTRY dưới đây.
//   3. Chạy lại `pnpm db:seed` — idempotent (upsert theo Province.code /
//      [provinceId, code] của Ward), an toàn chạy lại nhiều lần kể cả khi
//      đã có User/Profile thật tham chiếu đến các Ward hiện có.

import { HCMC_PROVINCE, HCMC_WARDS } from "./hcmc-wards";

export interface ProvinceSeedEntry {
  province: { code: string; name: string };
  wards: string[];
}

export const PROVINCE_REGISTRY: ProvinceSeedEntry[] = [
  { province: HCMC_PROVINCE, wards: HCMC_WARDS },
  // TODO(Prompt B4): 33 tỉnh/thành còn lại — chờ chủ dự án cung cấp nguồn
  // chính thức (tên + danh sách phường/xã theo đúng thứ tự) cho từng tỉnh,
  // theo quy trình 3 bước ở comment đầu file.
];
