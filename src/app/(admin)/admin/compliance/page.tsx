"use client";

import type { DataRequestStatus, DataRequestType } from "@prisma/client";
import { Loader2 } from "lucide-react";
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

const DATE_OPTS: Intl.DateTimeFormatOptions = { dateStyle: "medium" };

function deadlineFor(requestedAt: string) {
  return new Date(
    new Date(requestedAt).getTime() + DATA_REQUEST_SLA_DAYS * 86_400_000,
  );
}

function DataRequestsPanel() {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, status]);

  const process = async (id: string, action: "complete" | "reject") => {
    if (action === "reject" && !notes[id]?.trim()) {
      toast.add({
        title: "A note is required to reject a request",
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
      toast.add({ title: "Failed to update request", type: "error" });
      return;
    }
    toast.add({ title: "Request updated", type: "success" });
    load();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <NativeSelect
          value={type}
          onChange={setType}
          options={[
            { value: "", label: "All types" },
            { value: "EXPORT", label: "Export" },
            { value: "DELETION", label: "Deletion" },
          ]}
          className="w-44"
        />
        <NativeSelect
          value={status}
          onChange={setStatus}
          options={[
            { value: "", label: "All statuses" },
            { value: "PENDING", label: "Pending" },
            { value: "PROCESSING", label: "Processing" },
            { value: "COMPLETED", label: "Completed" },
            { value: "REJECTED", label: "Rejected" },
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
          No data requests
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
                        "Unknown user"}
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
                    Requested{" "}
                    {new Date(r.requestedAt).toLocaleDateString(
                      "en-US",
                      DATE_OPTS,
                    )}
                  </span>
                  {r.status === "PENDING" || r.status === "PROCESSING" ? (
                    <span
                      className={
                        isOverdue ? "font-semibold text-danger" : undefined
                      }
                    >
                      Deadline {deadline.toLocaleDateString("en-US", DATE_OPTS)}
                      {isOverdue ? " — overdue" : ""}
                    </span>
                  ) : r.completedAt ? (
                    <span>
                      Completed{" "}
                      {new Date(r.completedAt).toLocaleDateString(
                        "en-US",
                        DATE_OPTS,
                      )}
                    </span>
                  ) : null}
                </div>
                {r.note ? (
                  <p className="text-body-sm text-text-primary">{r.note}</p>
                ) : null}

                {actionable ? (
                  <>
                    <Textarea
                      placeholder="Rejection note (required to reject)"
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
                        Process deletion
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === r.id}
                        onClick={() => process(r.id, "reject")}
                      >
                        Reject
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
          placeholder="Actor user ID"
          className="w-56"
        />
        <Input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="Action contains…"
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
                <th className="px-5 py-3">When</th>
                <th className="px-3 py-3">Actor</th>
                <th className="px-3 py-3">Action</th>
                <th className="px-3 py-3">Target</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-border-subtle last:border-b-0"
                >
                  <td className="px-5 py-3 text-text-secondary">
                    {new Date(log.createdAt).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-3 py-3 text-text-secondary">
                    {log.actor?.firstName ??
                      log.actor?.name ??
                      log.actor?.email ??
                      log.actorId ??
                      "System"}
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
              No audit log entries
            </p>
          ) : null}
        </Card>
      )}
    </div>
  );
}

const PURPOSE_LABELS: Record<ConsentStat["purpose"], string> = {
  SERVICE: "Service (mandatory)",
  MARKETING: "Marketing",
  ANALYTICS: "Analytics",
};

function ConsentStatsPanel() {
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
            granted, {stat.revoked} not granted ({stat.total} users total)
          </span>
        </Card>
      ))}
    </div>
  );
}

export default function AdminCompliancePage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-display-md text-text-primary">Compliance</h1>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTab value="requests">Data requests</TabsTab>
          <TabsTab value="audit">Audit log</TabsTab>
          <TabsTab value="consent">Consent stats</TabsTab>
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
