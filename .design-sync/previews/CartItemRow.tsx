import { CartItemRow } from "fgrapher";

const photo = (from: string, to: string, label: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='300' height='300' fill='url(#g)'/><rect x='80' y='110' width='140' height='90' rx='14' fill='rgba(0,0,0,0.35)'/><circle cx='150' cy='155' r='30' fill='rgba(255,255,255,0.25)'/><text x='20' y='280' font-family='sans-serif' font-size='22' fill='rgba(255,255,255,0.75)'>${label}</text></svg>`,
  )}`;

const shop = {
  id: "shop1",
  name: "Trần Quốc Huy",
  firstName: "Huy",
  profiles: [
    {
      shopName: "Máy Ảnh Sài Gòn",
      deliveryFee: 30000,
      province: { name: "Thành phố Hồ Chí Minh" },
      ward: { name: "Phường Bến Thành" },
    },
  ],
};

const product = (overrides: Record<string, unknown>) => ({
  id: "p",
  name: "",
  currency: "VND",
  price: null,
  rentalPrice: null,
  depositAmount: null,
  images: [],
  user: shop,
  ...overrides,
});

const rental = {
  id: "c1",
  productId: "p1",
  quantity: 1,
  type: "RENT",
  rentalStart: "2026-10-10T00:00:00.000Z",
  rentalEnd: "2026-10-12T00:00:00.000Z",
  product: product({
    id: "p1",
    name: "Sony A7 IV kèm ống kính 24-70mm f/2.8 GM II",
    rentalPrice: 450000,
    depositAmount: 15000000,
    images: [{ id: "i1", url: photo("#1c2b36", "#8fb3c7", "Sony A7 IV") }],
  }),
};

const purchase = {
  id: "c2",
  productId: "p2",
  quantity: 2,
  type: "SALE",
  rentalStart: null,
  rentalEnd: null,
  product: product({
    id: "p2",
    name: "Pin Godox V1 VB26A chính hãng",
    price: 850000,
    images: [{ id: "i2", url: photo("#0f3d33", "#c9a24d", "Godox") }],
  }),
};

const noImage = {
  id: "c3",
  productId: "p3",
  quantity: 1,
  type: "SALE",
  rentalStart: null,
  rentalEnd: null,
  product: product({
    id: "p3",
    name: "Chân đèn studio Jinbei 2,8m (đã qua sử dụng)",
    price: 420000,
  }),
};

const noop = () => {};

export const Rental = () => (
  <div className="max-w-md">
    <CartItemRow item={rental} onUpdateQuantity={noop} onRemove={noop} />
  </div>
);

export const Purchase = () => (
  <div className="max-w-md">
    <CartItemRow item={purchase} onUpdateQuantity={noop} onRemove={noop} />
  </div>
);

export const NoPhoto = () => (
  <div className="max-w-md">
    <CartItemRow item={noImage} onUpdateQuantity={noop} onRemove={noop} />
  </div>
);

export const ShopGroup = () => (
  <div className="flex max-w-md flex-col gap-4 rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-surface p-4">
    <div className="flex flex-col">
      <span className="text-body-md font-semibold text-text-primary">
        Máy Ảnh Sài Gòn
      </span>
      <span className="text-body-sm text-text-tertiary">
        Phường Bến Thành, Thành phố Hồ Chí Minh
      </span>
    </div>
    <CartItemRow item={rental} onUpdateQuantity={noop} onRemove={noop} />
    <CartItemRow item={purchase} onUpdateQuantity={noop} onRemove={noop} />
  </div>
);
