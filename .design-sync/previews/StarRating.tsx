import { StarRating } from "fgrapher";

export const WithCount = () => <StarRating rating="4.9" reviews={128} />;

export const Sizes = () => (
  <div className="flex items-center gap-6">
    <StarRating rating="4.8" reviews={36} size={12} />
    <StarRating rating="4.8" reviews={36} />
    <StarRating rating="4.8" reviews={36} size={22} className="text-body-md" />
  </div>
);

// One review's own stars: no count, sitting in the review header.
export const SingleReview = () => (
  <div className="flex w-[360px] flex-col gap-1">
    <div className="flex items-center justify-between">
      <span className="text-body-md font-semibold! text-text-primary">
        Trần Thu Hà
      </span>
      <span className="text-body-sm text-text-tertiary">14/09/2026</span>
    </div>
    <StarRating rating={5} />
    <p className="text-body-sm text-text-secondary">
      Anh chụp rất có tâm, ảnh cưới trả đúng hẹn, màu đẹp hơn mong đợi.
    </p>
  </div>
);

export const NewProvider = () => (
  <div className="flex items-center gap-8">
    <div className="flex flex-col gap-1">
      <StarRating rating="Mới" reviews={0} hideCountWhenZero />
      <span className="text-body-sm text-text-tertiary">Thẻ hồ sơ công khai</span>
    </div>
    <div className="flex flex-col gap-1">
      <StarRating rating="Mới" reviews={0} />
      <span className="text-body-sm text-text-tertiary">Bảng điều khiển đánh giá</span>
    </div>
  </div>
);
