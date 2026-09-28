import { ImageCropDialog } from "fgrapher";

const noop = () => {};

const photo = (w: number, h: number, from: string, to: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='${w}' height='${h}' fill='url(#g)'/><circle cx='${w / 2}' cy='${h * 0.42}' r='${Math.min(w, h) * 0.18}' fill='rgba(255,255,255,0.35)'/><ellipse cx='${w / 2}' cy='${h * 0.95}' rx='${Math.min(w, h) * 0.34}' ry='${Math.min(w, h) * 0.3}' fill='rgba(255,255,255,0.25)'/></svg>`,
  )}`;

export const Avatar = () => (
  <ImageCropDialog
    open
    onOpenChange={noop}
    imageSrc={photo(900, 1200, "#3b2a1a", "#e8d3a8")}
    aspect={1}
    fileName="anh-dai-dien.jpg"
    mimeType="image/jpeg"
    onCropped={noop}
  />
);

export const CoverPhoto = () => (
  <ImageCropDialog
    open
    onOpenChange={noop}
    imageSrc={photo(1600, 1000, "#0f3d33", "#c9a24d")}
    aspect={3}
    fileName="anh-bia-studio.jpg"
    mimeType="image/jpeg"
    onCropped={noop}
  />
);
