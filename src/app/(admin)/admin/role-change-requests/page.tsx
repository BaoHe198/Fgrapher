"use client";

import { ArrowLeftRight, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { startTransition, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";

interface RoleChangeRequestRow {
  id: string;
  fromRole: string;
  toRole: string;
  reason: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    firstName: string | null;
    email: string;
  };
}

export default function AdminRoleChangeRequestsPage() {
  const t = useTranslations("accountFlows.admin.roleChangeRequests");
  const roleT = useTranslations("role");

  // Lazy initializer runs once on mount rather than calling Date.now()
  // directly during render, which React Compiler flags as an impurity.
  const [now] = useState(() => Date.now());

  function waitingLabel(createdAt: string) {
    const days = Math.floor((now - new Date(createdAt).getTime()) / 86_400_000);
    if (days <= 0) return t("submittedToday");
    if (days === 1) return t("waitingOneDay");
    return t("waitingDays", { days });
  }

  const [rows, setRows] = useState<RoleChangeRequestRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reasonNote, setReasonNote] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    startTransition(() => setIsLoading(true));
    fetch("/api/admin/role-change-requests")
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

  const review = async (id: string, action: "approve" | "reject") => {
    setBusyId(id);
    await fetch(`/api/admin/role-change-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "approve"
          ? { action }
          : { action, reason: reasonNote[id]?.trim() || undefined },
      ),
    });
    setBusyId(null);
    toast.add({ title: t("requestUpdated"), type: "success" });
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
          <ArrowLeftRight className="size-12 text-text-tertiary" />
          <p className="text-body-lg font-semibold! text-text-primary">
            {t("empty")}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((row) => (
            <Card key={row.id} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-body-md font-semibold! text-text-primary">
                    {row.user.firstName ?? row.user.name ?? row.user.email}
                  </span>
                  <Badge variant="neutral">{roleT(row.fromRole)}</Badge>
                  <ArrowLeftRight className="size-3.5 text-text-tertiary" />
                  <Badge variant="accent">{roleT(row.toRole)}</Badge>
                </div>
                <span className="text-body-sm text-text-tertiary">
                  {waitingLabel(row.createdAt)}
                </span>
              </div>
              <p className="text-body-sm text-text-secondary">
                {row.user.email}
              </p>
              {row.reason ? (
                <p className="text-body-sm text-text-secondary">
                  {t("userReason", { reason: row.reason })}
                </p>
              ) : null}

              <Textarea
                placeholder={t("rejectionNotePlaceholder")}
                rows={1}
                value={reasonNote[row.id] ?? ""}
                onChange={(e) =>
                  setReasonNote((prev) => ({
                    ...prev,
                    [row.id]: e.target.value,
                  }))
                }
              />

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
