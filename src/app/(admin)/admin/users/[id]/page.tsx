"use client";

import type {
  BookingStatus,
  Role,
  Subscription,
  SubscriptionStatus,
  User,
  UserRole,
} from "@prisma/client";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { startTransition, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { PAID_ROLES, ROLE_LABELS } from "@/lib/constants";

function defaultExpiryDate() {
  const d = new Date();
  d.setMonth(d.getMonth() + 12);
  return d.toISOString().slice(0, 10);
}

type UserDetail = User & {
  roles: (UserRole & { subscription: Subscription | null })[];
  bookingsAsCustomer: { id: string; status: BookingStatus }[];
  bookingsAsProvider: { id: string; status: BookingStatus }[];
};

const SUB_STATUS_VARIANT: Record<
  SubscriptionStatus,
  "warning" | "success" | "neutral" | "destructive"
> = {
  ACTIVE: "success",
  TRIALING: "success",
  PAST_DUE: "warning",
  CANCELLED: "destructive",
  EXPIRED: "destructive",
};

export default function AdminUserDetailPage() {
  const t = useTranslations("accountFlows.admin.userDetail");
  const params = useParams<{ id: string }>();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [notes, setNotes] = useState("");
  const [planRole, setPlanRole] = useState<Role>(PAID_ROLES[0]);
  const [planName, setPlanName] = useState("FREE");
  const [planExpiresAt, setPlanExpiresAt] = useState(defaultExpiryDate());
  const [planNote, setPlanNote] = useState("");

  const load = () => {
    fetch(`/api/admin/users/${params.id}`)
      .then((res) => res.json())
      .then((body) => {
        startTransition(() => {
          if (body.data) {
            setUser(body.data);
            setNotes(body.data.adminNotes ?? "");
          }
          setIsLoading(false);
        });
      });
  };

  useEffect(() => {
    load();
    // `load` is a fresh closure every render but only truly depends on
    // params.id — re-fetches exactly when navigating to a different user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const runAction = async (action: string, extra?: Record<string, unknown>) => {
    setBusy(true);
    await fetch(`/api/admin/users/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    setBusy(false);
    setSuspendOpen(false);
    toast.add({ title: t("updatedToast"), type: "success" });
    setIsLoading(true);
    load();
  };

  const assignPlan = async () => {
    if (!planName.trim() || !planExpiresAt) return;
    await runAction("assign_plan", {
      role: planRole,
      plan: planName.trim(),
      expiresAt: new Date(planExpiresAt).toISOString(),
      note: planNote.trim() || undefined,
    });
    setPlanNote("");
  };

  if (isLoading || !user) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-text-tertiary" />
      </div>
    );
  }

  const bookingsTotal = user.bookingsAsProvider.length;
  const completed = user.bookingsAsProvider.filter(
    (b) => b.status === "COMPLETED",
  ).length;
  const cancelled = user.bookingsAsProvider.filter(
    (b) => b.status === "CANCELLED" || b.status === "DECLINED",
  ).length;

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/admin/users"
        className="flex w-fit items-center gap-1.5 text-body-sm font-semibold text-text-secondary"
      >
        <ArrowLeft className="size-4" />
        {t("backToUsers")}
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-display-md text-text-primary">
          {user.firstName ?? user.name ?? user.email}
        </h1>
        {user.isSuspended ? (
          <Badge variant="destructive">{t("suspendedBadge")}</Badge>
        ) : null}
        {user.isVerified ? (
          <Badge variant="success">{t("verifiedBadge")}</Badge>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {user.isSuspended ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => runAction("unsuspend")}
          >
            {t("unsuspend")}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={() => setSuspendOpen(true)}
          >
            {t("suspend")}
          </Button>
        )}
        {!user.isVerified ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => runAction("verify")}
          >
            {t("verifyAccount")}
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            if (confirm(t("deleteConfirm"))) {
              runAction("delete");
            }
          }}
        >
          {t("deleteAccount")}
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTab value="overview">{t("tabs.overview")}</TabsTab>
          <TabsTab value="billing">{t("tabs.billing")}</TabsTab>
          <TabsTab value="bookings">{t("tabs.bookings")}</TabsTab>
        </TabsList>

        <TabsPanel value="overview" className="mt-4">
          <div className="flex flex-col gap-4">
            <Card
              padding={false}
              className="flex flex-col divide-y divide-border-subtle"
            >
              {[
                [t("fields.email"), user.email],
                [t("fields.username"), user.username ?? "—"],
                [t("fields.location"), user.location ?? "—"],
                [
                  t("fields.joined"),
                  new Date(user.createdAt).toLocaleDateString("en-US", {
                    dateStyle: "long",
                  }),
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <span className="text-body-sm text-text-tertiary">
                    {label}
                  </span>
                  <span className="text-body-md text-text-primary">
                    {value}
                  </span>
                </div>
              ))}
            </Card>

            <Card className="flex flex-col gap-2">
              <span className="text-body-sm font-semibold text-text-primary">
                {t("adminNotesLabel")}
              </span>
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <Button
                size="sm"
                variant="secondary"
                className="w-fit"
                disabled={busy}
                onClick={() => runAction("notes", { notes })}
              >
                {t("saveNotes")}
              </Button>
            </Card>
          </div>
        </TabsPanel>

        <TabsPanel value="billing" className="mt-4">
          <Card className="mb-4 flex flex-col gap-3">
            <span className="text-body-sm font-semibold text-text-primary">
              Gán gói thủ công (billing đang tắt — xem CLAUDE.md)
            </span>
            <div className="grid grid-cols-2 gap-3">
              <NativeSelect
                label="Vai trò"
                value={planRole}
                onChange={(v) => setPlanRole(v as Role)}
                options={PAID_ROLES.map((role) => ({
                  value: role,
                  label: ROLE_LABELS[role],
                }))}
              />
              <Input
                label="Tên gói"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
              />
              <Input
                label="Hết hạn"
                type="date"
                value={planExpiresAt}
                onChange={(e) => setPlanExpiresAt(e.target.value)}
              />
            </div>
            <Textarea
              placeholder="Ghi chú lý do (lưu vào nhật ký AdminAction)"
              rows={2}
              value={planNote}
              onChange={(e) => setPlanNote(e.target.value)}
            />
            <Button
              size="sm"
              variant="accent"
              className="w-fit"
              disabled={busy || !planName.trim() || !planExpiresAt}
              onClick={assignPlan}
            >
              Lưu gói
            </Button>
          </Card>

          <div className="flex flex-col gap-3">
            {user.roles.length === 0 ? (
              <p className="text-body-sm text-text-secondary">{t("noRoles")}</p>
            ) : (
              user.roles.map((ur) => (
                <Card key={ur.id} className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-body-md font-semibold text-text-primary">
                      {ROLE_LABELS[ur.role as Role]}
                    </span>
                    <span className="text-body-sm text-text-secondary">
                      {ur.active ? t("activeRole") : t("inactiveRole")}
                    </span>
                  </div>
                  {ur.subscription ? (
                    <Badge variant={SUB_STATUS_VARIANT[ur.subscription.status]}>
                      {ur.subscription.status}
                    </Badge>
                  ) : (
                    <Badge variant="neutral">{t("noSubscription")}</Badge>
                  )}
                </Card>
              ))
            )}
          </div>
        </TabsPanel>

        <TabsPanel value="bookings" className="mt-4">
          <div className="grid grid-cols-3 gap-4">
            <Card className="flex flex-col gap-1">
              <span className="text-body-sm text-text-tertiary">
                {t("asProvider")}
              </span>
              <span className="text-heading-lg text-text-primary">
                {bookingsTotal}
              </span>
            </Card>
            <Card className="flex flex-col gap-1">
              <span className="text-body-sm text-text-tertiary">
                {t("completionRate")}
              </span>
              <span className="text-heading-lg text-text-primary">
                {bookingsTotal > 0
                  ? Math.round((completed / bookingsTotal) * 100)
                  : 0}
                %
              </span>
            </Card>
            <Card className="flex flex-col gap-1">
              <span className="text-body-sm text-text-tertiary">
                {t("cancellationRate")}
              </span>
              <span className="text-heading-lg text-text-primary">
                {bookingsTotal > 0
                  ? Math.round((cancelled / bookingsTotal) * 100)
                  : 0}
                %
              </span>
            </Card>
          </div>
          <p className="mt-3 text-body-sm text-text-secondary">
            {t("bookingsSummary", {
              customerCount: user.bookingsAsCustomer.length,
              providerCount: bookingsTotal,
            })}
          </p>
        </TabsPanel>
      </Tabs>

      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("suspendDialogTitle")}</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder={t("suspendReasonPlaceholder")}
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSuspendOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={!suspendReason.trim() || busy}
              onClick={() => runAction("suspend", { reason: suspendReason })}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("suspend")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
