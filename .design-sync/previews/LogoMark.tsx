import { LogoMark } from "fgrapher";

export const Sizes = () => (
  <div className="flex items-end gap-6">
    <LogoMark size={16} />
    <LogoMark size={28} />
    <LogoMark size={48} />
    <LogoMark size={96} />
  </div>
);

export const AppIcon = () => (
  <div className="flex items-center gap-4">
    <div className="flex size-20 items-center justify-center rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-surface shadow-[var(--shadow-md)]">
      <LogoMark size={52} />
    </div>
    <div className="flex size-20 items-center justify-center rounded-full bg-bg-sunken">
      <LogoMark size={44} />
    </div>
  </div>
);
