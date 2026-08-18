"use client";

import { useState } from "react";

import { Switch } from "@/components/ui/switch";

export function AcceptingBookingsToggle({ initialValue }: { initialValue: boolean }) {
  const [checked, setChecked] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);

  const onChange = async (next: boolean) => {
    setChecked(next);
    setIsSaving(true);

    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acceptingBookings: next }),
    });

    setIsSaving(false);
    if (!res.ok) {
      setChecked(!next);
    }
  };

  return (
    <Switch
      label="Accepting bookings"
      checked={checked}
      onChange={onChange}
      disabled={isSaving}
    />
  );
}
