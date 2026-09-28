import { useEffect } from "react";
import { QrCodeDialog } from "fgrapher";

const noop = () => {};

// The dialog auto-focuses its close button on open; in a capture that shows
// as a keyboard focus ring. Drop focus once the dialog has settled.
function useDropInitialFocus() {
  useEffect(() => {
    const timers = [80, 250, 600].map((ms) =>
      setTimeout(() => {
        const el = document.activeElement;
        if (el instanceof HTMLElement && el !== document.body) el.blur();
      }, ms),
    );
    return () => timers.forEach(clearTimeout);
  }, []);
}

export const PhotographerProfile = () => {
  useDropInitialFocus();
  return <QrCodeDialog open onOpenChange={noop} url="https://fgrapher.vn/profile/minhanh" />;
};

export const StudioProfile = () => {
  useDropInitialFocus();
  return (
    <QrCodeDialog open onOpenChange={noop} url="https://fgrapher.vn/profile/studio-nang-saigon" />
  );
};
