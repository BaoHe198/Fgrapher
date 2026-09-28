import { Button, Card, Input, SocialRow } from "fgrapher";

export const Default = () => (
  <div className="flex w-full max-w-sm flex-col gap-4">
    <SocialRow />
  </div>
);

export const InLoginForm = () => (
  <Card className="flex w-full max-w-md flex-col gap-4 p-6">
    <div className="flex flex-col gap-1">
      <h2 className="text-heading-md text-text-primary">Đăng nhập</h2>
      <p className="text-body-sm text-text-secondary">
        Chào mừng bạn quay lại Fgrapher.
      </p>
    </div>
    <Input type="email" placeholder="Email" defaultValue="thuha@gmail.com" />
    <Input type="password" placeholder="Mật khẩu" />
    <Button variant="accent" className="w-full">
      Đăng nhập
    </Button>
    <SocialRow />
  </Card>
);
