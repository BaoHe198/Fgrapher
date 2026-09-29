import { SectionNav } from "fgrapher";

export const Profile = () => (
  <div className="w-[720px] bg-bg-page">
    <SectionNav label="Các mục trong hồ sơ" offset={0} topClassName="top-0" activeId="services" items={[
      { id: "portfolio", label: "Portfolio" },
      { id: "services", label: "Gói dịch vụ" },
      { id: "reviews", label: "Đánh giá" },
      { id: "area", label: "Khu vực phục vụ" },
    ]} />
  </div>
);
