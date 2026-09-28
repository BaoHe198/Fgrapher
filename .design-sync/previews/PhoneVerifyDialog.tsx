import { PhoneVerifyDialog } from "fgrapher";

const noop = () => {};

export const SavedPhone = () => (
  <PhoneVerifyDialog open onOpenChange={noop} phone="0901 234 567" onVerified={noop} />
);

export const NoPhoneYet = () => (
  <PhoneVerifyDialog open onOpenChange={noop} phone="" onVerified={noop} />
);
