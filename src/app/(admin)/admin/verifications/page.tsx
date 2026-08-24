"use client";

import { BadgeCheck, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { startTransition, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { KYC_REJECTION_REASONS } from "@/lib/constants";

interface VerificationRow {
  id: string;
  role: string;
  verificationStatus: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    firstName: string | null;
    email: string;
    dateOfBirth: string | null;
  };
}

const IMAGE_KIND_VALUES: ("front" | "back" | "selfie")[] = [
  "front",
  "back",
  "selfie",
];

export default function AdminVerificationsPage() {
  const t = useTranslations("accountFlows.admin.verifications");
  const IMAGE_KINDS: { kind: "front" | "back" | "selfie"; label: string }[] =
    IMAGE_KIND_VALUES.map((kind) => ({
      kind,
      label:
        kind === "front"
          ? t("imageFront")
          : kind === "back"
            ? t("imageBack")
            : t("imageSelfie"),
    }));

  // Lazy initializer runs once on mount rather than calling Date.now()
  // directly during render, which React Compiler flags as an impurity.
  const [now] = useState(() => Date.now());

  function waitingLabel(createdAt: string) {
    const days = Math.floor((now - new Date(createdAt).getTime()) / 86_400_000);
    if (days <= 0) return t("submittedToday");
    if (days === 1) return t("waitingOneDay");
    return t("waitingDays", { days });
  }

  const [rows, setRows] = useState<VerificationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reasonPreset, setReasonPreset] = useState<Record<string, string>>({});
  const [reasonNote, setReasonNote] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState<string | null>(null);

  const load = () => {
    startTransition(() => setIsLoading(true));
    fetch("/api/admin/verifications")
      .then((res) => res.json())
      .then((body) => {
        startTransition(() => {
          setRows(body.data ?? []);
          setIsLoading(false);
        });
      });
  };

  useEffect(() => {
    load();
  }, []);

  const viewImage = async (
    userRoleId: string,
    kind: "front" | "back" | "selfie",
  ) => {
    setLoadingImage(`${userRoleId}-${kind}`);
    const res = await fetch(
      `/api/admin/verifications/${userRoleId}/image?kind=${kind}`,
    );
    const body = await res.json();
    setLoadingImage(null);
    if (!res.ok) {
      toast.add({
        title: body.message ?? t("failedToLoadDocument"),
        type: "error",
      });
      return;
    }
    window.open(body.data.url, "_blank", "noopener,noreferrer");
  };

  const review = async (id: string, action: "approve" | "reject") => {
    if (action === "reject" && !reasonPreset[id]) {
      toast.add({ title: t("selectRejectionReason"), type: "error" });
      return;
    }

    setBusyId(id);
    await fetch(`/api/admin/verifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "approve"
          ? { action }
          : {
              action,
              reason: reasonNote[id]?.trim()
                ? `${reasonPreset[id]} — ${reasonNote[id].trim()}`
                : reasonPreset[id],
            },
      ),
    });
    setBusyId(null);
    toast.add({ title: t("verificationUpdated"), type: "success" });
    load();
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-display-md text-text-primary">{t("title")}</h1>
        <p className="text-body-md text-text-secondary">{t("description")}</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-text-tertiary" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <BadgeCheck className="size-12 text-text-tertiary" />
          <p className="text-body-lg font-semibold text-text-primary">
            {t("empty")}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((row) => (
            <Card key={row.id} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="neutral">{row.role}</Badge>
                  <span className="text-body-md font-semibold text-text-primary">
                    {row.user.firstName ?? row.user.name ?? row.user.email}
                  </span>
                </div>
                <span className="text-body-sm text-text-tertiary">
                  {waitingLabel(row.createdAt)}
                </span>
              </div>
              <p className="text-body-sm text-text-secondary">
                {row.user.email}
              </p>

              <div className="flex flex-wrap gap-2">
                {IMAGE_KINDS.map(({ kind, label }) => (
                  <Button
                    key={kind}
                    size="sm"
                    variant="secondary"
                    disabled={loadingImage === `${row.id}-${kind}`}
                    onClick={() => viewImage(row.id, kind)}
                  >
                    {loadingImage === `${row.id}-${kind}` ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    {t("viewImage", { label })}
                  </Button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <NativeSelect
                  value={reasonPreset[row.id] ?? ""}
                  onChange={(value) =>
                    setReasonPreset((prev) => ({ ...prev, [row.id]: value }))
                  }
                  options={[
                    { value: "", label: t("rejectionReasonPlaceholder") },
                    ...KYC_REJECTION_REASONS.map((r) => ({
                      value: r,
                      label: r,
                    })),
                  ]}
                />
                <Textarea
                  placeholder={t("notePlaceholder")}
                  rows={1}
                  value={reasonNote[row.id] ?? ""}
                  onChange={(e) =>
                    setReasonNote((prev) => ({
                      ...prev,
                      [row.id]: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="accent"
                  disabled={busyId === row.id}
                  onClick={() => review(row.id, "approve")}
                >
                  {t("approve")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === row.id}
                  onClick={() => review(row.id, "reject")}
                >
                  {t("reject")}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
