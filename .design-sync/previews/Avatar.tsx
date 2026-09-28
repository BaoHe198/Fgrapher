import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "fgrapher";

const face = (from: string, to: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='120' height='120' fill='url(#g)'/><circle cx='60' cy='48' r='22' fill='rgba(255,255,255,0.55)'/><ellipse cx='60' cy='112' rx='38' ry='30' fill='rgba(255,255,255,0.55)'/></svg>`,
  )}`;

export const Sizes = () => (
  <div className="flex items-center gap-4">
    <Avatar size="sm">
      <AvatarImage src={face("#0f3d33", "#c9a24d")} alt="Minh Anh" />
      <AvatarFallback>MA</AvatarFallback>
    </Avatar>
    <Avatar>
      <AvatarImage src={face("#3b2a1a", "#e8d3a8")} alt="Ngọc Linh" />
      <AvatarFallback>NL</AvatarFallback>
    </Avatar>
    <Avatar size="lg">
      <AvatarImage src={face("#1c2b36", "#8fb3c7")} alt="Hoàng Phúc" />
      <AvatarFallback>HP</AvatarFallback>
    </Avatar>
  </div>
);

export const Fallback = () => (
  <div className="flex items-center gap-4">
    <Avatar size="sm">
      <AvatarFallback>TT</AvatarFallback>
    </Avatar>
    <Avatar>
      <AvatarFallback>QH</AvatarFallback>
    </Avatar>
    <Avatar size="lg">
      <AvatarFallback>ĐK</AvatarFallback>
    </Avatar>
  </div>
);

export const WithBadge = () => (
  <div className="flex items-center gap-4">
    <Avatar size="lg">
      <AvatarImage src={face("#0f3d33", "#c9a24d")} alt="Minh Anh" />
      <AvatarFallback>MA</AvatarFallback>
      <AvatarBadge className="bg-success" />
    </Avatar>
    <div className="flex flex-col">
      <span className="text-body-md font-semibold text-text-primary">
        Minh Anh Nhiếp Ảnh
      </span>
      <span className="text-body-sm text-text-secondary">Đang hoạt động</span>
    </div>
  </div>
);

export const Group = () => (
  <AvatarGroup>
    <Avatar size="lg">
      <AvatarImage src={face("#0f3d33", "#c9a24d")} alt="Minh Anh" />
      <AvatarFallback>MA</AvatarFallback>
    </Avatar>
    <Avatar size="lg">
      <AvatarImage src={face("#3b2a1a", "#e8d3a8")} alt="Ngọc Linh" />
      <AvatarFallback>NL</AvatarFallback>
    </Avatar>
    <Avatar size="lg">
      <AvatarFallback>HP</AvatarFallback>
    </Avatar>
    <AvatarGroupCount>+12</AvatarGroupCount>
  </AvatarGroup>
);
