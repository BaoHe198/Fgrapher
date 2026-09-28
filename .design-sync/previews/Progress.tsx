import { Progress, ProgressLabel, ProgressValue } from "fgrapher";

export const ProfileCompletion = () => (
  <div className="max-w-md">
    <Progress value={60}>
      <ProgressLabel>Hoàn thiện hồ sơ</ProgressLabel>
      <ProgressValue />
    </Progress>
  </div>
);

export const Steps = () => (
  <div className="flex max-w-md flex-col gap-6">
    <Progress value={0}>
      <ProgressLabel>Tải ảnh portfolio</ProgressLabel>
      <ProgressValue />
    </Progress>
    <Progress value={35}>
      <ProgressLabel>Xác minh danh tính</ProgressLabel>
      <ProgressValue />
    </Progress>
    <Progress value={100}>
      <ProgressLabel>Thông tin cơ bản</ProgressLabel>
      <ProgressValue />
    </Progress>
  </div>
);

export const Uploading = () => (
  <div className="max-w-md">
    <Progress value={72}>
      <ProgressLabel>Đang tải lên anh-cuoi-da-lat.jpg</ProgressLabel>
      <ProgressValue />
    </Progress>
  </div>
);
