"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

/** Withdraws a proposal that is not public yet. */
export function WithdrawPlaceButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const t = useTranslations("places.mine");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const withdraw = async () => {
    if (!window.confirm(t("withdrawConfirm", { name }))) return;
    setBusy(true);
    const res = await fetch(`/api/places/${id}`, { method: "DELETE" }).catch(
      () => null,
    );
    const body = await res?.json().catch(() => null);
    setBusy(false);
    toast.add({
      title: body?.message ?? "",
      type: res?.ok ? "success" : "error",
    });
    if (res?.ok) router.refresh();
  };

  return (
    <Button variant="ghost" size="sm" onClick={withdraw} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" /> : null}
      {t("withdraw")}
    </Button>
  );
}
