import { MessagesSkeleton } from "fgrapher";

export const Default = () => <MessagesSkeleton />;

export const InDashboardPage = () => (
  <div className="flex flex-col gap-4 bg-bg-page p-6">
    <h1 className="text-heading-xl text-text-primary">Tin nhắn</h1>
    <MessagesSkeleton />
  </div>
);
