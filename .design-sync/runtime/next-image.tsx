// Design-sync shim for next/image: a plain <img> with the same fill/size
// behaviour, since the Next image optimizer isn't there outside the app.
import type { CSSProperties, ImgHTMLAttributes } from "react";

interface ImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string | { src: string };
  alt: string;
  fill?: boolean;
  priority?: boolean;
  quality?: number;
  unoptimized?: boolean;
  placeholder?: string;
  blurDataURL?: string;
  sizes?: string;
}

export default function Image({
  src,
  fill,
  priority: _priority,
  quality: _quality,
  unoptimized: _unoptimized,
  placeholder: _placeholder,
  blurDataURL: _blur,
  style,
  ...rest
}: ImageProps) {
  const fillStyle: CSSProperties = fill
    ? { position: "absolute", inset: 0, width: "100%", height: "100%" }
    : {};
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={typeof src === "string" ? src : src.src}
      style={{ ...fillStyle, ...style }}
      {...rest}
    />
  );
}
