import { Button, LogoFull } from "fgrapher";

export const Default = () => <LogoFull />;

export const Sizes = () => (
  <div className="flex flex-col items-start gap-4">
    <LogoFull size={20} />
    <LogoFull size={28} />
    <LogoFull size={40} />
  </div>
);

export const InHeader = () => (
  <header className="flex w-full max-w-2xl items-center justify-between border-b border-border-subtle bg-bg-surface px-5 py-3">
    <LogoFull />
    <nav className="flex items-center gap-5 text-body-md text-text-secondary">
      <a href="#">Khám phá</a>
      <a href="#">Tìm nhà cung cấp</a>
    </nav>
    <Button size="sm">Đăng nhập</Button>
  </header>
);
