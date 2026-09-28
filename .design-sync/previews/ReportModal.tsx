import { ReportModal } from "fgrapher";

const noop = () => {};

export const ReportUser = () => (
  <ReportModal open onOpenChange={noop} targetType="user" targetId="usr_minhanh" />
);

export const ReportReview = () => (
  <ReportModal open onOpenChange={noop} targetType="review" targetId="rv_2381" />
);

export const ReportMessage = () => (
  <ReportModal open onOpenChange={noop} targetType="message" targetId="msg_9912" />
);
