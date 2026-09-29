import { useState } from "react";
import { TimeSlotGrid } from "fgrapher";

const slots = [
  { start: "05:30", status: "available", golden: true },
  { start: "06:00", status: "available", golden: true },
  { start: "08:00", status: "booked" },
  { start: "09:00", status: "available" },
  { start: "14:00", status: "available" },
  { start: "16:30", status: "available", golden: true },
  { start: "17:00", status: "taken", golden: true },
  { start: "19:00", status: "available" },
] as const;

export const GoldenHour = () => {
  const [selected, setSelected] = useState<string | null>("06:00");
  return (
    <div className="max-w-lg">
      <TimeSlotGrid slots={[...slots]} selected={selected} onSelect={setSelected} timezoneLabel="Giờ Việt Nam (GMT+7)" />
    </div>
  );
};

export const NoSlots = () => (
  <div className="max-w-lg">
    <TimeSlotGrid slots={[{ start: "09:00", status: "booked" }, { start: "14:00", status: "booked" }]} selected={null} onSelect={() => {}} timezoneLabel="Giờ Việt Nam (GMT+7)" />
  </div>
);
