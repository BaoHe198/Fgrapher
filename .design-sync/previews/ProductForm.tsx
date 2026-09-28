import { ProductForm } from "fgrapher";

const photo = (from: string, to: string, label: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='400' height='400' fill='url(#g)'/><circle cx='200' cy='190' r='92' fill='rgba(0,0,0,0.35)'/><circle cx='200' cy='190' r='56' fill='rgba(255,255,255,0.18)'/><text x='24' y='376' font-family='sans-serif' font-size='26' fill='rgba(255,255,255,0.75)'>${label}</text></svg>`,
  )}`;

export const NewListing = () => (
  <div className="max-w-2xl">
    <ProductForm sellerRole="CAMERA_SHOP" />
  </div>
);

export const EditRental = () => (
  <div className="max-w-2xl">
    <ProductForm
      productId="prod_godox"
      sellerRole="STUDIO"
      defaultValues={{
        name: "Đèn flash Godox AD600 Pro",
        description:
          "Đèn ngoài trời 600Ws, kèm 2 pin và softbox 90cm. Nhận tại Phường Thủ Đức, Thành phố Hồ Chí Minh.",
        category: "Lighting",
        type: "RENT",
        rentalPrice: 350000,
        depositAmount: 5000000,
        condition: "GOOD",
        stock: 2,
        isActive: true,
        images: [
          { url: photo("#1a1a1a", "#c9a24d", "Godox AD600"), publicId: "g1" },
          { url: photo("#23303b", "#8fb3c7", "Softbox"), publicId: "g2" },
        ],
      }}
    />
  </div>
);

export const SaleAndRent = () => (
  <div className="max-w-2xl">
    <ProductForm
      productId="prod_a7iv"
      sellerRole="PHOTOGRAPHER"
      defaultValues={{
        name: "Sony A7 IV (body) — 8.200 shot",
        description: "Máy chính hãng, còn bảo hành đến 03/2027. Đủ hộp, sạc, 2 pin.",
        category: "Camera body",
        type: "BOTH",
        price: 42500000,
        rentalPrice: 600000,
        depositAmount: 15000000,
        condition: "LIKE_NEW",
        stock: 1,
        isActive: false,
        images: [
          { url: photo("#1a1a1a", "#5a5a5a", "Sony A7 IV"), publicId: "s1" },
        ],
      }}
    />
  </div>
);
