import { useEffect, useRef } from "react";
import { Toaster, useToastManager } from "fgrapher";

interface ToastSeed {
  title: string;
  description?: string;
  type?: "success" | "error" | "info" | "warning" | "loading";
  action?: string;
}

// Toasts only exist once something calls the manager, so each story adds
// its own on mount; timeout 0 keeps them on screen for the capture.
function Seed({ toasts }: { toasts: ToastSeed[] }) {
  const manager = useToastManager();
  const added = useRef(false);
  useEffect(() => {
    if (added.current) return;
    added.current = true;
    for (const t of toasts) {
      manager.add({
        title: t.title,
        description: t.description,
        type: t.type,
        timeout: 0,
        actionProps: t.action ? { children: t.action } : undefined,
      });
    }
  }, [manager, toasts]);
  return null;
}

export const BookingSent = () => (
  <Toaster>
    <Seed
      toasts={[
        {
          type: "success",
          title: "Đã gửi yêu cầu đặt lịch",
          description:
            "Minh Anh Nhiếp Ảnh sẽ phản hồi lịch chụp ngày 12/10/2026 trong vòng 24 giờ.",
        },
      ]}
    />
  </Toaster>
);

export const UploadFailed = () => (
  <Toaster>
    <Seed
      toasts={[
        {
          type: "error",
          title: "Tải ảnh lên thất bại",
          description: "Ảnh vượt quá 20MB. Vui lòng chọn ảnh nhỏ hơn.",
          action: "Thử lại",
        },
      ]}
    />
  </Toaster>
);

export const PendingModeration = () => (
  <Toaster>
    <Seed
      toasts={[
        {
          type: "info",
          title: "Ảnh đang chờ kiểm duyệt",
          description:
            "8 ảnh mới sẽ hiển thị trên hồ sơ công khai sau khi được duyệt.",
        },
      ]}
    />
  </Toaster>
);

export const Stacked = () => (
  <Toaster>
    <Seed
      toasts={[
        { type: "warning", title: "Lịch ngày 18/10/2026 sắp kín" },
        { type: "success", title: "Đã lưu gói dịch vụ" },
        {
          type: "success",
          title: "Đã xác nhận lịch đặt",
          description: "Trần Thu Hà · Chụp kỷ yếu · 1.500.000₫",
        },
      ]}
    />
  </Toaster>
);
