import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "fgrapher";

export const AccountMenu = () => (
  <DropdownMenu open>
    <DropdownMenuTrigger render={<Button variant="secondary" />}>
      Minh Anh Nhiếp Ảnh
    </DropdownMenuTrigger>
    <DropdownMenuContent className="w-56">
      <DropdownMenuGroup>
        <DropdownMenuLabel>minhanh@fgrapher.vn</DropdownMenuLabel>
        <DropdownMenuItem>Hồ sơ công khai</DropdownMenuItem>
        <DropdownMenuItem>
          Lịch đặt của tôi
          <DropdownMenuShortcut>3 mới</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>Tin nhắn</DropdownMenuItem>
        <DropdownMenuItem>Cài đặt tài khoản</DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive">Đăng xuất</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

export const SortSelect = () => (
  <DropdownMenu open>
    <DropdownMenuTrigger render={<Button variant="outline" />}>
      Sắp xếp: Đánh giá cao nhất
    </DropdownMenuTrigger>
    <DropdownMenuContent className="w-56">
      <DropdownMenuRadioGroup value="rating">
        <DropdownMenuRadioItem value="relevant">Phù hợp nhất</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="rating">
          Đánh giá cao nhất
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="price-asc">Giá thấp đến cao</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="newest">Mới tham gia</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
);

export const CategoryFilter = () => (
  <DropdownMenu open>
    <DropdownMenuTrigger render={<Button variant="secondary" />}>
      Thể loại (2)
    </DropdownMenuTrigger>
    <DropdownMenuContent className="w-56">
      <DropdownMenuGroup>
        <DropdownMenuLabel>Chọn thể loại chụp</DropdownMenuLabel>
        <DropdownMenuCheckboxItem checked>Ảnh cưới</DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked>Chân dung</DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem>Kỷ yếu</DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem>Sự kiện</DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem disabled>
          Sản phẩm (sắp có)
        </DropdownMenuCheckboxItem>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
);
