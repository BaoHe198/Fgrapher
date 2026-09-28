import { useEffect } from "react";
import { ReviewModal } from "fgrapher";

// The dialog auto-focuses the first star on open; in a capture that shows as
// a keyboard focus box. Drop focus once the dialog has settled.
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

const noop = () => {};

export const NewReview = () => {
  useDropInitialFocus();
  return (
    <ReviewModal
      open
      onOpenChange={noop}
      bookingId="bk_20261012"
      providerName="Minh Anh Nhiếp Ảnh"
      serviceName="Gói chụp ảnh cưới ngoại cảnh · 12/10/2026"
    />
  );
};

export const PrefilledRating = () => {
  useDropInitialFocus();
  return (
    <ReviewModal
      open
      onOpenChange={noop}
      bookingId="bk_20260915"
      providerName="Thu Hà Makeup"
      serviceName="Trang điểm cô dâu + làm tóc · 15/09/2026"
      initialRating={4}
    />
  );
};

export const EditExisting = () => {
  useDropInitialFocus();
  return (
    <ReviewModal
      open
      onOpenChange={noop}
      bookingId="bk_20260820"
      providerName="Studio Nắng Sài Gòn"
      serviceName="Thuê studio 4 giờ · 20/08/2026"
      existingReview={{
        id: "rv_1",
        rating: 5,
        content:
          "Studio rộng, ánh sáng tự nhiên rất đẹp, có sẵn phông trắng và phông vải. Anh quản lý hỗ trợ setup đèn nhiệt tình, giá 1.200.000₫ cho 4 giờ là quá hợp lý.",
      }}
    />
  );
};
