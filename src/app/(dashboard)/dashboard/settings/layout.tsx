import { SettingsNav } from "./settings-nav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-display-md text-text-primary">Settings</h1>
      <SettingsNav />
      <div className="max-w-2xl">{children}</div>
    </div>
  );
}
