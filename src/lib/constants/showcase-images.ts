import type { ProfileCategory, Role } from "@prisma/client";

// Fixed showcase artwork for the home page's "Bạn cần ai?" tiles and
// "Duyệt theo phong cách" collages and the About page's photo sheet
// (owner, 08/10/2026). These used to be the newest approved portfolio
// photos, which put whatever a provider last uploaded - a chart, an empty
// slot - on the front page. Free Unsplash photos, credited in
// public/images/showcase/README.md; replace a file there to change one.

export interface ShowcasePhoto {
  src: string;
  width: number;
  height: number;
}

const photo = (file: string, width: number, height: number): ShowcasePhoto => ({
  src: `/images/showcase/${file}`,
  width,
  height,
});

/** Per role: the tile photo first, then a second one for the About sheet. */
export const ROLE_PHOTOS = {
  PHOTOGRAPHER: [
    photo("roles/photographer.jpg", 1200, 812),
    photo("roles/photographer-2.jpg", 1200, 1800),
  ],
  VIDEOGRAPHER: [
    photo("roles/videographer.jpg", 1200, 1800),
    photo("roles/videographer-2.jpg", 1200, 800),
  ],
  MAKEUP_ARTIST: [
    photo("roles/makeup-artist.jpg", 1200, 1800),
    photo("roles/makeup-artist-2.jpg", 1200, 1800),
  ],
  MODEL: [
    photo("roles/model.jpg", 1200, 1524),
    photo("roles/model-2.jpg", 1200, 1800),
  ],
  STUDIO: [
    photo("roles/studio.jpg", 1200, 800),
    photo("roles/studio-2.jpg", 1200, 800),
  ],
  COSTUME_SHOP: [
    photo("roles/costume-shop.jpg", 1200, 1800),
    photo("roles/costume-shop-2.jpg", 1200, 1500),
  ],
  CAMERA_SHOP: [photo("roles/camera-shop.jpg", 1200, 1800)],
} satisfies Partial<Record<Role, ShowcasePhoto[]>>;

/** Per style: the large frame first, then the two small ones. */
export const STYLE_PHOTOS = {
  WEDDING: [
    photo("styles/wedding-1.jpg", 1200, 800),
    photo("styles/wedding-2.jpg", 1200, 1799),
    photo("styles/wedding-3.jpg", 1200, 1800),
  ],
  PORTRAIT: [
    photo("styles/portrait-1.jpg", 1200, 800),
    photo("styles/portrait-2.jpg", 1200, 875),
    photo("styles/portrait-3.jpg", 1200, 1800),
  ],
  YEARBOOK: [
    photo("styles/yearbook-1.jpg", 1200, 800),
    photo("styles/yearbook-2.jpg", 1200, 1800),
    photo("styles/yearbook-3.jpg", 1200, 899),
  ],
  EVENT: [
    photo("styles/event-1.jpg", 1200, 800),
    photo("styles/event-2.jpg", 1200, 800),
    photo("styles/event-3.jpg", 1200, 800),
  ],
  FASHION: [
    photo("styles/fashion-1.jpg", 1200, 1800),
    photo("styles/fashion-2.jpg", 1200, 1800),
    photo("styles/fashion-3.jpg", 1200, 1800),
  ],
  PRODUCT: [
    photo("styles/product-1.jpg", 1200, 1800),
    photo("styles/product-2.jpg", 1200, 1500),
    photo("styles/product-3.jpg", 1200, 1800),
  ],
} satisfies Partial<Record<ProfileCategory, ShowcasePhoto[]>>;
