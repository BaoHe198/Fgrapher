import { useState } from "react";
import { AvailabilityCalendar } from "fgrapher";

const days = Array.from({ length: 31 }, (_, i) => {
  const date = `2026-10-${String(i + 1).padStart(2, "0")}`;
  const status = i < 4 ? "past" : i % 7 === 5 ? "off" : i % 6 === 0 ? "full" : "available";
  return { date, status } as { date: string; status: "past" | "off" | "full" | "available" };
});

export const Month = () => {
  const [selected, setSelected] = useState<string | null>("2026-10-14");
  return (
    <div className="max-w-md">
      <AvailabilityCalendar month={new Date(2026, 9, 1)} days={days} selected={selected} onSelect={setSelected} onMonthChange={() => {}} />
    </div>
  );
};

export const Week = () => (
  <div className="max-w-md">
    <AvailabilityCalendar compact="week" month={new Date(2026, 9, 1)} days={days.slice(10, 17)} selected="2026-10-12" onSelect={() => {}} />
  </div>
);

export const Loading = () => (
  <div className="max-w-md">
    <AvailabilityCalendar month={new Date(2026, 9, 1)} days={[]} selected={null} loading onSelect={() => {}} />
  </div>
);
