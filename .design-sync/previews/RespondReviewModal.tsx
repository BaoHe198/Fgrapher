import { RespondReviewModal } from "fgrapher";

const noop = () => {};

export const NewResponse = () => (
  <RespondReviewModal
    open
    onOpenChange={noop}
    reviewId="rv_1"
    reviewerName="Nguyễn Thảo Vy"
    rating={5}
    content="Anh Minh chụp rất có tâm, hướng dẫn tạo dáng kỹ nên dù lần đầu chụp ảnh cưới mình vẫn rất tự nhiên. Ảnh giao đúng hẹn, màu đẹp."
  />
);

export const EditResponse = () => (
  <RespondReviewModal
    open
    onOpenChange={noop}
    reviewId="rv_2"
    reviewerName="Trần Quốc Bảo"
    rating={4}
    content="Ảnh kỷ yếu đẹp, cả lớp đều thích. Chỉ tiếc buổi chụp bắt đầu trễ khoảng 20 phút."
    existingResponse="Cảm ơn Bảo và cả lớp đã tin tưởng! Hôm đó team kẹt xe trên cầu Sài Gòn, lần sau mình sẽ xuất phát sớm hơn để không làm mọi người phải chờ."
  />
);

export const LowRating = () => (
  <RespondReviewModal
    open
    onOpenChange={noop}
    reviewId="rv_3"
    reviewerName="Lê Hoàng Nam"
    rating={2}
    content="Giao ảnh chậm hơn hẹn một tuần, nhắn tin mấy lần mới được trả lời."
  />
);
