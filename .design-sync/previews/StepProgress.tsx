import { StepProgress } from "fgrapher";

const steps = ["Gói", "Ngày", "Giờ", "Địa điểm", "Ghi chú", "Xem lại"];

export const Booking = () => (
  <div className="w-[860px]">
    <StepProgress label="Tiến trình đặt lịch" steps={steps} current={2} onStepClick={() => {}} />
  </div>
);

export const LaterStep = () => (
  <div className="w-[360px]">
    <StepProgress label="Tiến trình đặt lịch" steps={steps} current={4} />
  </div>
);
