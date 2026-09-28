import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "fgrapher";

export const ConfirmCancel = () => (
  <Dialog open>
    <DialogContent initialFocus={false}>
      <DialogHeader>
        <DialogTitle>Hủy lịch chụp ngày 12/10/2026?</DialogTitle>
        <DialogDescription>
          Nhiếp ảnh gia sẽ nhận được thông báo ngay. Nếu đã đặt cọc, bạn trao
          đổi hoàn cọc trực tiếp với nhiếp ảnh gia trong phần tin nhắn.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="secondary">Giữ lịch</Button>
        <Button variant="destructive">Hủy lịch</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
