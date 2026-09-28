import { Alert, AlertAction, AlertDescription, AlertTitle, Button } from "fgrapher";
import { CircleAlertIcon, InfoIcon, ShieldCheckIcon } from "lucide-react";

export const Info = () => (
  <div className="max-w-[520px]">
    <Alert>
      <InfoIcon />
      <AlertTitle>Hồ sơ của bạn đang chờ xác minh</AlertTitle>
      <AlertDescription>
        Chúng tôi sẽ xem xét giấy tờ trong vòng 1–2 ngày làm việc. Hồ sơ sẽ
        được công khai ngay khi xác minh xong.
      </AlertDescription>
    </Alert>
  </div>
);

export const Destructive = () => (
  <div className="max-w-[520px]">
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertTitle>Không thể gửi yêu cầu đặt lịch</AlertTitle>
      <AlertDescription>
        Nhiếp ảnh gia đã kín lịch ngày 12/10/2026. Vui lòng chọn ngày khác
        hoặc nhắn tin để trao đổi thêm.
      </AlertDescription>
    </Alert>
  </div>
);

export const WithAction = () => (
  <div className="max-w-[520px]">
    <Alert>
      <ShieldCheckIcon />
      <AlertTitle>Xác minh danh tính để nhận lịch</AlertTitle>
      <AlertDescription>
        Khách hàng chỉ thấy hồ sơ đã xác minh.
      </AlertDescription>
      <AlertAction>
        <Button size="sm">Xác minh</Button>
      </AlertAction>
    </Alert>
  </div>
);
