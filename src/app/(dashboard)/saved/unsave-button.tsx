"use client";

import { BookmarkX, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

interface UnsaveButtonProps {
  profileId: string;
}

// Removing a saved artist used to mean opening their profile and finding the
// bookmark icon there; the saved list itself had no way out.
export function UnsaveButton({ profileId }: UnsaveButtonProps) {
  const t = useTranslations("dashboardCore.saved");
  const router = useRouter();
  const [isRemoving, setIsRemoving] = useState(false);

  const remove = async () => {
    setIsRemoving(true);
    const res = await fetch(`/api/saved-profiles?profileId=${profileId}`, {
      method: "DELETE",
    }).catch(() => null);
    if (res?.ok) {
      router.refresh();
    } else {
      setIsRemoving(false);
      toast.add({ title: t("removeFailed"), type: "error" });
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="self-end"
      disabled={isRemoving}
      onClick={remove}
    >
      {isRemoving ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <BookmarkX className="size-4" />
      )}
      {t("remove")}
    </Button>
  );
}
