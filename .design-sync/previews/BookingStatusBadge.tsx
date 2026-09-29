import { BookingStatusBadge } from "fgrapher";

export const AllStatuses = () => (
  <div className="flex flex-wrap gap-2">
    {(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "DECLINED", "NO_SHOW", "EXPIRED"] as const).map((status) => (
      <BookingStatusBadge key={status} status={status} />
    ))}
  </div>
);
