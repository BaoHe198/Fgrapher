"use client";

import type { Report, ReportStatus } from "@prisma/client";
import { Flag, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { startTransition, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";

type ReportRow = Report & {
  reporter: {
    name: string | null;
    firstName: string | null;
    email: string;
  } | null;
};

const TAB_VALUES: (ReportStatus | "ALL")[] = [
  "PENDING",
  "REVIEWING",
  "RESOLVED",
  "DISMISSED",
  "ALL",
];

export default function AdminReportsPage() {
  const t = useTranslations("accountFlows.admin.reports");
  const TAB_LABELS: Record<ReportStatus | "ALL", string> = {
    PENDING: t("tabs.pending"),
    REVIEWING: t("tabs.reviewing"),
    RESOLVED: t("tabs.resolved"),
    DISMISSED: t("tabs.dismissed"),
    ALL: t("tabs.all"),
  };
  const [tab, setTab] = useState<ReportStatus | "ALL">("PENDING");
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    startTransition(() => setIsLoading(true));
    fetch(`/api/admin/reports${tab !== "ALL" ? `?status=${tab}` : ""}`)
      .then((res) => res.json())
      .then((body) => {
        startTransition(() => {
          setReports(body.data ?? []);
          setIsLoading(false);
        });
      });
  };

  useEffect(() => {
    load();
    // `load` is a fresh closure every render but only truly depends on
    // tab, already listed — re-fetches exactly when the filter tab changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const resolve = async (id: string, status: "RESOLVED" | "DISMISSED") => {
    setBusyId(id);
    await fetch(`/api/admin/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, note: notes[id] }),
    });
    setBusyId(null);
    toast.add({ title: t("reportUpdatedToast"), type: "success" });
    load();
  };

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-display-md text-text-primary">{t("title")}</h1>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as ReportStatus | "ALL")}
      >
        <TabsList>
          {TAB_VALUES.map((value) => (
            <TabsTab key={value} value={value}>
              {TAB_LABELS[value]}
            </TabsTab>
          ))}
        </TabsList>
        {TAB_VALUES.map((value) => (
          <TabsPanel key={value} value={value} />
        ))}
      </Tabs>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-text-tertiary" />
        </div>
      ) : reports.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <Flag className="size-12 text-text-tertiary" />
          <p className="text-body-lg font-semibold text-text-primary">
            {t("empty")}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {reports.map((report) => (
            <Card key={report.id} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {report.priority === "HIGH" ? (
                    <Badge variant="destructive">{t("highPriority")}</Badge>
                  ) : null}
                  <Badge variant="neutral">{report.targetType}</Badge>
                  <span className="text-body-md font-semibold text-text-primary">
                    {report.reason}
                  </span>
                </div>
                <span className="text-body-sm text-text-tertiary">
                  {new Date(report.createdAt).toLocaleDateString("en-US", {
                    dateStyle: "medium",
                  })}
                </span>
              </div>
              <p className="text-body-sm text-text-secondary">
                {t("reportedBy", {
                  name:
                    report.reporter?.firstName ??
                    report.reporter?.name ??
                    report.reporter?.email ??
                    t("unknownReporter"),
                })}{" "}
                {t("targetIdLabel")}{" "}
                <code className="text-body-sm">{report.targetId}</code>
              </p>
              {report.description ? (
                <p className="text-body-md text-text-primary">
                  {report.description}
                </p>
              ) : null}

              {report.status === "PENDING" || report.status === "REVIEWING" ? (
                <>
                  <Textarea
                    placeholder={t("resolutionNotePlaceholder")}
                    rows={2}
                    value={notes[report.id] ?? ""}
                    onChange={(e) =>
                      setNotes((prev) => ({
                        ...prev,
                        [report.id]: e.target.value,
                      }))
                    }
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="accent"
                      disabled={busyId === report.id}
                      onClick={() => resolve(report.id, "RESOLVED")}
                    >
                      {t("resolve")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === report.id}
                      onClick={() => resolve(report.id, "DISMISSED")}
                    >
                      {t("dismiss")}
                    </Button>
                  </div>
                </>
              ) : (
                <Badge
                  variant={report.status === "RESOLVED" ? "success" : "neutral"}
                >
                  {report.status}
                </Badge>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
