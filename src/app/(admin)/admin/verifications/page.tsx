"use client";

import { BadgeCheck, Loader2 } from "lucide-react";
import { startTransition, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

interface VerificationRow {
  id: string;
  role: string;
  verificationStatus: string;
  updatedAt: string;
  user: { id: string; name: string | null; firstName: string | null; email: string; dateOfBirth: string | null };
}

export default function AdminVerificationsPage() {
  const [rows, setRows] = useState<VerificationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const review = async (id: string, action: "approve" | "reject") => {
    setBusyId(id);
    await fetch(`/api/admin/verifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "approve" ? { action } : { action, reason: reasons[id] || "Not specified" },
      ),
    });
    setBusyId(null);
    toast.add({ title: "Verification updated", type: "success" });
    load();
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-display-md text-text-primary">Identity verification</h1>
        <p className="text-body-md text-text-secondary">
          Pending ID verification requests — currently only used by the Model role. The
          user-facing ID upload flow isn&apos;t enabled yet, so this queue is expected to be
          empty until it is.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-text-tertiary" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <BadgeCheck className="size-12 text-text-tertiary" />
          <p className="text-body-lg font-semibold text-text-primary">Nothing pending</p>
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
                  Submitted {new Date(row.updatedAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
                </span>
              </div>
              <p className="text-body-sm text-text-secondary">{row.user.email}</p>

              <Input
                placeholder="Rejection reason (required if rejecting)"
                value={reasons[row.id] ?? ""}
                onChange={(e) => setReasons((prev) => ({ ...prev, [row.id]: e.target.value }))}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="accent"
                  disabled={busyId === row.id}
                  onClick={() => review(row.id, "approve")}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === row.id}
                  onClick={() => review(row.id, "reject")}
                >
                  Reject
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
