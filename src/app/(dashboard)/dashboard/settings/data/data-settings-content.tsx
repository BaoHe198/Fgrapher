"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";

interface DataSettingsContentProps {
  initialConsent: { MARKETING: boolean; ANALYTICS: boolean };
  pendingDeletion: boolean;
  summary: {
    profiles: number;
    bookingsAsCustomer: number;
    bookingsAsProvider: number;
    reviewsWritten: number;
    reviewsReceived: number;
    orders: number;
  };
}

const SUMMARY_LABELS: {
  key: keyof DataSettingsContentProps["summary"];
  label: string;
}[] = [
  { key: "profiles", label: "Hồ sơ" },
  { key: "bookingsAsCustomer", label: "Đơn đặt lịch đã gửi" },
  { key: "bookingsAsProvider", label: "Đơn đặt lịch đã nhận" },
  { key: "reviewsWritten", label: "Đánh giá đã viết" },
  { key: "reviewsReceived", label: "Đánh giá đã nhận" },
  { key: "orders", label: "Đơn hàng" },
];

export function DataSettingsContent({
  initialConsent,
  pendingDeletion,
  summary,
}: DataSettingsContentProps) {
  const [consent, setConsent] = useState(initialConsent);
  const [isExporting, setIsExporting] = useState(false);
  const [deletionRequested, setDeletionRequested] = useState(pendingDeletion);
  const [isRequestingDeletion, setIsRequestingDeletion] = useState(false);
  const [deleteStep, setDeleteStep] = useState<
    "closed" | "explain" | "confirm"
  >("closed");

  const toggleConsent = async (
    purpose: "MARKETING" | "ANALYTICS",
    granted: boolean,
  ) => {
    setConsent((prev) => ({ ...prev, [purpose]: granted }));
    const res = await fetch("/api/users/me/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose, granted }),
    });
    if (!res.ok) {
      setConsent((prev) => ({ ...prev, [purpose]: !granted }));
      toast.add({ title: "Không thể cập nhật lựa chọn", type: "error" });
      return;
    }
    toast.add({ title: "Đã cập nhật lựa chọn", type: "success" });
  };

  const exportData = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/users/me/export", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        toast.add({
          title: body.message ?? "Xuất dữ liệu thất bại",
          type: "error",
        });
        return;
      }
      const blob = new Blob([JSON.stringify(body.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "fgrapher-du-lieu-cua-toi.json";
      link.click();
      URL.revokeObjectURL(url);
      toast.add({ title: "Đã tải về dữ liệu của bạn", type: "success" });
    } finally {
      setIsExporting(false);
    }
  };

  const requestDeletion = async () => {
    setIsRequestingDeletion(true);
    try {
      const res = await fetch("/api/users/me/deletion-request", {
        method: "POST",
      });
      if (!res.ok) {
        toast.add({
          title: "Gửi yêu cầu xóa tài khoản thất bại",
          type: "error",
        });
        return;
      }
      setDeletionRequested(true);
      setDeleteStep("closed");
      toast.add({
        title: "Đã gửi yêu cầu xóa tài khoản",
        description: "Đội ngũ Fgrapher sẽ xử lý yêu cầu này.",
        type: "success",
      });
    } finally {
      setIsRequestingDeletion(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <span className="text-body-md font-semibold text-text-primary">
          Tổng quan dữ liệu của bạn
        </span>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SUMMARY_LABELS.map(({ key, label }) => (
            <div
              key={key}
              className="rounded-[var(--fg-radius-md)] border border-border-subtle p-3"
            >
              <div className="text-heading-md text-text-primary">
                {summary[key]}
              </div>
              <div className="text-body-sm text-text-secondary">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="h-px bg-border-subtle" />

      <div className="flex flex-col gap-3">
        <span className="text-body-md font-semibold text-text-primary">
          Đồng ý sử dụng dữ liệu
        </span>
        <p className="text-body-sm text-text-secondary">
          Việc xử lý dữ liệu để cung cấp dịch vụ là bắt buộc và không thể tắt
          tại đây. Bạn có thể bật/tắt hai mục tùy chọn dưới đây bất cứ lúc nào.
        </p>
        <div className="flex items-center justify-between rounded-[var(--fg-radius-md)] border border-border-subtle p-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-body-md text-text-primary">
              Thông tin khuyến mại
            </span>
            <span className="text-body-sm text-text-secondary">
              Nhận email về khuyến mại, tin tức từ Fgrapher
            </span>
          </div>
          <Switch
            aria-label="Thông tin khuyến mại"
            checked={consent.MARKETING}
            onChange={(value) => toggleConsent("MARKETING", value)}
          />
        </div>
        <div className="flex items-center justify-between rounded-[var(--fg-radius-md)] border border-border-subtle p-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-body-md text-text-primary">
              Phân tích hành vi sử dụng
            </span>
            <span className="text-body-sm text-text-secondary">
              Cho phép Fgrapher phân tích cách bạn sử dụng dịch vụ để cải thiện
              sản phẩm
            </span>
          </div>
          <Switch
            aria-label="Phân tích hành vi sử dụng"
            checked={consent.ANALYTICS}
            onChange={(value) => toggleConsent("ANALYTICS", value)}
          />
        </div>
        <p className="text-body-sm text-text-tertiary">
          Xem chi tiết tại{" "}
          <Link href="/privacy" className="text-text-link hover:underline">
            Chính sách quyền riêng tư
          </Link>
          .
        </p>
      </div>

      <div className="h-px bg-border-subtle" />

      <div className="flex flex-col gap-3">
        <span className="text-body-md font-semibold text-text-primary">
          Dữ liệu của tôi
        </span>
        <p className="text-body-sm text-text-secondary">
          Tải về bản sao đầy đủ dữ liệu cá nhân, hồ sơ, đơn đặt lịch và đánh giá
          của bạn dưới dạng JSON.
        </p>
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          disabled={isExporting}
          onClick={exportData}
        >
          {isExporting ? <Loader2 className="size-4 animate-spin" /> : null}
          Tải về dữ liệu của tôi
        </Button>
      </div>

      <div className="h-px bg-border-subtle" />

      <div className="flex flex-col gap-2 rounded-[var(--fg-radius-md)] border border-danger p-4">
        <span className="text-body-md font-semibold text-danger">
          Xóa tài khoản
        </span>
        <p className="text-body-sm text-text-secondary">
          Yêu cầu xóa vĩnh viễn tài khoản của bạn. Yêu cầu này sẽ được đội ngũ
          Fgrapher xử lý, không xóa ngay lập tức.
        </p>
        {deletionRequested ? (
          <p className="text-body-sm font-semibold text-warning">
            Bạn đã có một yêu cầu xóa tài khoản đang chờ xử lý.
          </p>
        ) : (
          <Button
            variant="destructive"
            size="sm"
            className="self-start"
            onClick={() => setDeleteStep("explain")}
          >
            Yêu cầu xóa tài khoản
          </Button>
        )}

        <Dialog
          open={deleteStep !== "closed"}
          onOpenChange={(open) => setDeleteStep(open ? "explain" : "closed")}
        >
          <DialogContent>
            {deleteStep === "explain" ? (
              <>
                <DialogHeader>
                  <DialogTitle>
                    Điều gì sẽ xảy ra khi bạn xóa tài khoản?
                  </DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-3 text-body-sm text-text-secondary">
                  <div>
                    <span className="font-semibold text-text-primary">
                      Sẽ bị xóa vĩnh viễn:{" "}
                    </span>
                    hồ sơ, ảnh/portfolio, dịch vụ đã đăng, tin nhắn của bạn.
                  </div>
                  <div>
                    <span className="font-semibold text-text-primary">
                      Sẽ được giữ lại (đã ẩn danh):{" "}
                    </span>
                    tài khoản của bạn sẽ đổi thành &quot;Người dùng đã xóa&quot;
                    — email, số điện thoại, ngày sinh và các thông tin cá nhân
                    khác sẽ bị xóa, nhưng các đơn đặt lịch/đánh giá đã hoàn tất
                    vẫn được giữ để phía đối tác của bạn tra cứu.
                  </div>
                  <div className="font-semibold text-danger">
                    Hành động này không thể hoàn tác sau khi được xử lý.
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => setDeleteStep("closed")}
                  >
                    Hủy
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteStep("confirm")}
                  >
                    Tiếp tục
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Xác nhận gửi yêu cầu xóa tài khoản</DialogTitle>
                </DialogHeader>
                <p className="text-body-sm text-text-secondary">
                  Bạn có chắc chắn muốn gửi yêu cầu xóa vĩnh viễn tài khoản này
                  không? Yêu cầu sẽ được đội ngũ Fgrapher xử lý trong thời gian
                  sớm nhất.
                </p>
                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => setDeleteStep("explain")}
                  >
                    Quay lại
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={isRequestingDeletion}
                    onClick={requestDeletion}
                  >
                    {isRequestingDeletion ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    Xác nhận gửi yêu cầu
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
