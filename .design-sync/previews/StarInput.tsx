import { StarInput } from "fgrapher";

const noop = () => {};

export const WithLabel = () => (
  <StarInput value={4} onChange={noop} showLabel />
);

export const Scale = () => (
  <div className="flex flex-col items-start gap-3">
    {[1, 2, 3, 4, 5].map((v) => (
      <StarInput key={v} value={v} onChange={noop} size={24} showLabel />
    ))}
  </div>
);

export const Empty = () => (
  <div className="flex flex-col items-center gap-2">
    <p className="text-body-md font-semibold! text-text-primary">
      Bạn đánh giá buổi chụp với Minh Anh thế nào?
    </p>
    <StarInput value={0} onChange={noop} />
  </div>
);

export const Small = () => (
  <StarInput value={5} onChange={noop} size={20} />
);
