import { Input } from "fgrapher";

export const Filled = () => (
  <div className="w-[360px]">
    <Input label="Tên hiển thị" defaultValue="Minh Anh Nhiếp Ảnh" />
  </div>
);

export const Types = () => (
  <div className="flex w-[360px] flex-col gap-4">
    <Input label="Email" type="email" placeholder="ban@vidu.vn" />
    <Input label="Số điện thoại" type="tel" defaultValue="0901 234 567" />
    <Input label="Mật khẩu" type="password" defaultValue="Fgrapher2026" />
  </div>
);

export const WithError = () => (
  <div className="w-[360px]">
    <Input
      label="Tên người dùng"
      defaultValue="minh anh"
      error="Tên người dùng chỉ gồm chữ thường, số và dấu gạch dưới."
    />
  </div>
);

export const Disabled = () => (
  <div className="w-[360px]">
    <Input
      label="Email đăng nhập"
      defaultValue="minhanh.photo@gmail.com"
      disabled
    />
  </div>
);

export const Bare = () => (
  <div className="w-[360px]">
    <Input placeholder="Tìm nhiếp ảnh gia, studio, trang phục…" />
  </div>
);
