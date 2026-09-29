import { useState } from "react";
import { Camera, Palette, User } from "lucide-react";
import { ChoiceCard, ChoiceCardGroup } from "fgrapher";

export const Packages = () => {
  const [value, setValue] = useState("b");
  return (
    <div className="max-w-xl">
      <ChoiceCardGroup legend="Chọn gói dịch vụ">
        <ChoiceCard name="pkg" value="a" selected={value === "a"} onSelect={setValue} title="Chân dung áo dài" description="30 ảnh chỉnh sửa · giao sau 5 ngày" price="2.000.000₫" />
        <ChoiceCard name="pkg" value="b" selected={value === "b"} onSelect={setValue} title="Ảnh cưới ngoại cảnh" description="120 ảnh chỉnh sửa · giao sau 14 ngày" price="5.500.000₫" />
        <ChoiceCard name="pkg" value="c" selected={value === "c"} onSelect={setValue} title="Tùy chỉnh" description="Mô tả nhu cầu, nghệ sĩ báo giá riêng" price="Báo giá sau" />
      </ChoiceCardGroup>
    </div>
  );
};

export const Roles = () => (
  <div className="max-w-2xl">
    <ChoiceCardGroup legend="Vai trò của bạn" className="grid-cols-2">
      <ChoiceCard name="roles" value="PHOTOGRAPHER" mode="multiple" selected onSelect={() => {}} icon={<Camera />} title="Nhiếp ảnh gia" description="Nhận đặt lịch chụp và đăng portfolio." />
      <ChoiceCard name="roles" value="MAKEUP_ARTIST" mode="multiple" selected={false} onSelect={() => {}} icon={<Palette />} title="Chuyên viên trang điểm" description="Trang điểm cô dâu, sự kiện, chụp ảnh." />
      <ChoiceCard name="roles" value="CUSTOMER" mode="multiple" selected disabled onSelect={() => {}} icon={<User />} title="Khách hàng" description="Luôn đi kèm mọi tài khoản." />
    </ChoiceCardGroup>
  </div>
);

export const States = () => (
  <div className="flex max-w-xl flex-col gap-3">
    <ChoiceCard name="s" value="1" selected={false} onSelect={() => {}} title="Tại studio của nghệ sĩ" description="Studio hoặc địa điểm quen của nghệ sĩ" />
    <ChoiceCard name="s" value="2" selected={false} invalid onSelect={() => {}} title="Ngoài trời" description="Chưa chọn — cần chọn nơi chụp để tiếp tục" />
    <ChoiceCard name="s" value="3" selected={false} disabled onSelect={() => {}} title="Đã kín lịch" description="Gói này tạm ngừng nhận" />
    <ChoiceCard name="s2" value="4" size="sm" selected onSelect={() => {}} title="Thuê studio nửa ngày" meta="4 tiếng" price="1.500.000₫" />
  </div>
);
