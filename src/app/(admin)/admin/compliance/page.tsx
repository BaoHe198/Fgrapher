"use client";

import type { DataRequestStatus, DataRequestType } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { startTransition, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { DATA_REQUEST_SLA_DAYS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";

interface DataRequestRow {
  id: string;
  type: DataRequestType;
  status: DataRequestStatus;
  requestedAt: string;
  completedAt: string | null;
  note: string | null;
  user: {
    id: string;
    name: string | null;
    firstName: string | null;
    email: string;
  } | null;
}

interface AuditLogRow {
  id: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: string;
  actor: {
    id: string;
    name: string | null;
    firstName: string | null;
    email: string;
  } | null;
}

interface ConsentStat {
  purpose: "SERVICE" | "MARKETING" | "ANALYTICS";
  granted: number;
  revoked: number;
  total: number;
}

function deadlineFor(requestedAt: string) {
  return new Date(
    new Date(requestedAt).getTime() + DATA_REQUEST_SLA_DAYS * 86_400_000,
  );
}

function DataRequestsPanel() {
  const t = useTranslations("accountFlows.admin.compliance.dataRequests");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [requests, setRequests] = useState<DataRequestRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    startTransition(() => setIsLoading(true));
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    fetch(`/api/admin/data-requests?${params.toString()}`)
      .then((res) => res.json())
      .then((body) => {
        startTransition(() => {
          setRequests(body.data ?? []);
          setIsLoading(false);
        });
      });
  };

  useEffect(() => {
    load();
    // `load` is a fresh closure every render but only truly depends on
    // type/status, both already listed — re-fetches exactly when a filter
    // changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, status]);

  const process = async (id: string, action: "complete" | "reject") => {
    if (action === "reject" && !notes[id]?.trim()) {
      toast.add({
        title: t("noteRequiredToast"),
        type: "error",
      });
      return;
    }
    setBusyId(id);
    const res = await fetch(`/api/admin/data-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "reject" ? { action, note: notes[id] } : { action },
      ),
    });
    setBusyId(null);
    if (!res.ok) {
      toast.add({ title: t("updateFailedToast"), type: "error" });
      return;
    }
    toast.add({ title: t("updatedToast"), type: "success" });
    load();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <NativeSelect
          value={type}
          onChange={setType}
          options={[
            { value: "", label: t("typeFilter.all") },
            { value: "EXPORT", label: t("typeFilter.export") },
            { value: "DELETION", label: t("typeFilter.deletion") },
          ]}
          className="w-44"
        />
        <NativeSelect
          value={status}
          onChange={setStatus}
          options={[
            { value: "", label: t("statusFilter.all") },
            { value: "PENDING", label: t("statusFilter.pending") },
            { value: "PROCESSING", label: t("statusFilter.processing") },
            { value: "COMPLETED", label: t("statusFilter.completed") },
            { value: "REJECTED", label: t("statusFilter.rejected") },
          ]}
          className="w-44"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-text-tertiary" />
        </div>
      ) : requests.length === 0 ? (
        <Card className="py-16 text-center text-body-sm text-text-secondary">
          {t("empty")}
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {requests.map((r) => {
            const deadline = deadlineFor(r.requestedAt);
            const isOverdue =
              deadline < new Date() &&
              (r.status === "PENDING" || r.status === "PROCESSING");
            const actionable =
              r.type === "DELETION" &&
              (r.status === "PENDING" || r.status === "PROCESSING");

            return (
              <Card key={r.id} className="flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        r.type === "DELETION" ? "destructive" : "neutral"
                      }
                    >
                      {r.type}
                    </Badge>
                    <span className="text-body-md font-semibold text-text-primary">
                      {r.user?.firstName ??
                        r.user?.name ??
                        r.user?.email ??
                        t("unknownUser")}
                    </span>
                    <span className="text-body-sm text-text-tertiary">
                      {r.user?.email}
                    </span>
                  </div>
                  <Badge
                    variant={
                      r.status === "COMPLETED"
                        ? "success"
                        : r.status === "REJECTED"
                          ? "destructive"
                          : "warning"
                    }
                  >
                    {r.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-body-sm text-text-secondary">
                  <span>
                    {t("requested", { date: formatDate(r.requestedAt) })}
                  </span>
                  {r.status === "PENDING" || r.status === "PROCESSING" ? (
                    <span
                      className={
                        isOverdue ? "font-semibold text-danger" : undefined
                      }
                    >
                      {t("deadline", { date: formatDate(deadline) })}
                      {isOverdue ? t("overdueSuffix") : ""}
                    </span>
                  ) : r.completedAt ? (
                    <span>
                      {t("completed", { date: formatDate(r.completedAt) })}
                    </span>
                  ) : null}
                </div>
                {r.note ? (
                  <p className="text-body-sm text-text-primary">{r.note}</p>
                ) : null}

                {actionable ? (
                  <>
                    <Textarea
                      placeholder={t("rejectNotePlaceholder")}
                      rows={2}
                      value={notes[r.id] ?? ""}
                      onChange={(e) =>
                        setNotes((prev) => ({
                          ...prev,
                          [r.id]: e.target.value,
                        }))
                      }
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busyId === r.id}
                        onClick={() => process(r.id, "complete")}
                      >
                        {busyId === r.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : null}
                        {t("processDeletion")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === r.id}
                        onClick={() => process(r.id, "reject")}
                      >
                        {t("rejectBtn")}
                      </Button>
                    </div>
                  </>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AuditLogPanel() {
  const t = useTranslations("accountFlows.admin.compliance.auditLog");
  const [actorId, setActorId] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    startTransition(() => setIsLoading(true));
    const params = new URLSearchParams();
    if (actorId) params.set("actorId", actorId);
    if (action) params.set("action", action);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const timeout = setTimeout(() => {
      fetch(`/api/admin/audit-log?${params.toString()}`)
        .then((res) => res.json())
        .then((body) => {
          startTransition(() => {
            setLogs(body.data ?? []);
            setIsLoading(false);
          });
        });
    }, 300);
    return () => clearTimeout(timeout);
  }, [actorId, action, from, to]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <Input
          value={actorId}
          onChange={(e) => setActorId(e.target.value)}
          placeholder={t("actorIdPlaceholder")}
          className="w-56"
        />
        <Input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder={t("actionPlaceholder")}
          className="w-56"
        />
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="w-44"
        />
        <Input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="w-44"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-text-tertiary" />
        </div>
      ) : (
        <Card padding={false} className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-body-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left text-text-tertiary">
                <th className="px-5 py-3">{t("colWhen")}</th>
                <th className="px-3 py-3">{t("colActor")}</th>
                <th className="px-3 py-3">{t("colAction")}</th>
                <th className="px-3 py-3">{t("colTarget")}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-border-subtle last:border-b-0"
                >
                  <td className="px-5 py-3 text-text-secondary">
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className="px-3 py-3 text-text-secondary">
                    {log.actor?.firstName ??
                      log.actor?.name ??
                      log.actor?.email ??
                      log.actorId ??
                      t("systemActor")}
                  </td>
                  <td className="px-3 py-3 font-semibold text-text-primary">
                    {log.action}
                  </td>
                  <td className="px-3 py-3 text-text-tertiary">
                    {log.targetType} ·{" "}
                    <code className="text-body-sm">{log.targetId}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 ? (
            <p className="px-5 py-8 text-center text-body-sm text-text-secondary">
              {t("empty")}
            </p>
          ) : null}
        </Card>
      )}
    </div>
  );
}

function ConsentStatsPanel() {
  const t = useTranslations("accountFlows.admin.compliance.consent");
  const PURPOSE_LABELS: Record<ConsentStat["purpose"], string> = {
    SERVICE: t("purposeService"),
    MARKETING: t("purposeMarketing"),
    ANALYTICS: t("purposeAnalytics"),
  };
  const [stats, setStats] = useState<ConsentStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/consent-stats")
      .then((res) => res.json())
      .then((body) => {
        startTransition(() => {
          setStats(body.data ?? []);
          setIsLoading(false);
        });
      });
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {stats.map((stat) => (
        <Card key={stat.purpose} className="flex flex-col gap-2">
          <span className="text-body-md font-semibold text-text-primary">
            {PURPOSE_LABELS[stat.purpose]}
          </span>
          <span className="text-heading-md text-text-primary">
            {stat.granted}
          </span>
          <span className="text-body-sm text-text-secondary">
            {t("grantedSuffix")}{" "}
            {t("notGrantedSummary", {
              revoked: stat.revoked,
              total: stat.total,
            })}
          </span>
        </Card>
      ))}
    </div>
  );
}

export default function AdminCompliancePage() {
  const t = useTranslations("accountFlows.admin.compliance");
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-display-md text-text-primary">{t("title")}</h1>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTab value="requests">{t("tabs.requests")}</TabsTab>
          <TabsTab value="audit">{t("tabs.audit")}</TabsTab>
          <TabsTab value="consent">{t("tabs.consent")}</TabsTab>
        </TabsList>
        <TabsPanel value="requests">
          <DataRequestsPanel />
        </TabsPanel>
        <TabsPanel value="audit">
          <AuditLogPanel />
        </TabsPanel>
        <TabsPanel value="consent">
          <ConsentStatsPanel />
        </TabsPanel>
      </Tabs>
    </div>
  );
}
