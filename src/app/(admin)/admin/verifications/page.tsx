"use client";

import { BadgeCheck, EyeOff, Images, Loader2 } from "lucide-react";
import type { Role } from "@prisma/client";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { KYC_REJECTION_REASONS } from "@/lib/constants";
import { formatDate } from "@/lib/format";

interface VerificationRow {
  id: string;
  role: string;
  verificationStatus: string;
  createdAt: string;
  /** What the provider declared: decides which documents to expect. */
  legalEntityType: "INDIVIDUAL" | "HOUSEHOLD_BUSINESS" | "COMPANY";
  hasBusinessDoc: boolean;
  /** Other accounts that submitted the same ID number. */
  sameIdAccounts: {
    userId: string;
    role: string;
    verificationStatus: string;
    name: string | null;
    email: string;
    deleted: boolean;
  }[];
  user: {
    id: string;
    name: string | null;
    firstName: string | null;
    email: string;
    dateOfBirth: string | null;
  };
}

type ImageKind = "front" | "back" | "selfie" | "business";

const IMAGE_KIND_VALUES: ImageKind[] = ["front", "back", "selfie", "business"];

// Whole years between a date of birth and today, by calendar date (the
// stored value is a date, so UTC parts are the date as entered).
function ageOn(dateOfBirth: string, today: Date) {
  const born = new Date(dateOfBirth);
  let age = today.getFullYear() - born.getUTCFullYear();
  const beforeBirthday =
    today.getMonth() < born.getUTCMonth() ||
    (today.getMonth() === born.getUTCMonth() &&
      today.getDate() < born.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export default function AdminVerificationsPage() {
  const t = useTranslations("accountFlows.admin.verifications");
  const roleT = useTranslations("role");
  const router = useRouter();
  const IMAGE_KINDS: { kind: ImageKind; label: string }[] =
    IMAGE_KIND_VALUES.map((kind) => ({
      kind,
      label:
        kind === "front"
          ? t("imageFront")
          : kind === "back"
            ? t("imageBack")
            : kind === "selfie"
              ? t("imageSelfie")
              : t("imageBusiness"),
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
  // The documents an admin asked to see side by side, per request. Kept in
  // memory only: the links are short-lived and nothing is stored here.
  const [documents, setDocuments] = useState<
    Record<string, { kind: ImageKind; label: string; url: string }[]>
  >({});

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

  const viewImage = async (userRoleId: string, kind: ImageKind) => {
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

  // Front, back and portrait on one screen, to compare with each other and
  // with the declared date of birth. Each one is fetched through the same
  // endpoint as the single buttons, so every view is still written to the
  // audit log (CLAUDE.md rule 7).
  const viewAll = async (row: VerificationRow) => {
    setLoadingImage(`${row.id}-all`);
    const kinds = IMAGE_KINDS.filter(
      ({ kind }) => kind !== "business" || row.hasBusinessDoc,
    );
    const loaded: { kind: ImageKind; label: string; url: string }[] = [];
    for (const { kind, label } of kinds) {
      const res = await fetch(
        `/api/admin/verifications/${row.id}/image?kind=${kind}`,
      );
      const body = await res.json().catch(() => null);
      if (res.ok && body?.data?.url) {
        loaded.push({ kind, label, url: body.data.url });
      }
    }
    setLoadingImage(null);
    if (loaded.length === 0) {
      toast.add({ title: t("failedToLoadDocument"), type: "error" });
      return;
    }
    setDocuments((prev) => ({ ...prev, [row.id]: loaded }));
  };

  const review = async (id: string, action: "approve" | "reject") => {
    if (action === "reject" && !reasonPreset[id]) {
      toast.add({ title: t("selectRejectionReason"), type: "error" });
      return;
    }

    setBusyId(id);
    const res = await fetch(`/api/admin/verifications/${id}`, {
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
    if (!res.ok) {
      // This used to toast "updated" whatever the answer was.
      const body = await res.json().catch(() => null);
      toast.add({
        title: body?.message ?? t("verificationUpdateFailed"),
        type: "error",
      });
      return;
    }
    toast.add({ title: t("verificationUpdated"), type: "success" });
    load();
    // The sidebar's waiting count comes from the server layout; without
    // this it kept showing the request that was just reviewed.
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-display-md text-text-primary">{t("title")}</h1>
        <p className="text-body-md text-text-secondary">{t("description")}</p>
      </div>

      {isLoading ? (
        <ListSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState icon={<BadgeCheck />} title={t("empty")} />
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((row) => (
            <Card key={row.id} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="neutral">{roleT(row.role as Role)}</Badge>
                  <span className="text-body-md font-semibold! text-text-primary">
                    {row.user.name ?? row.user.firstName ?? row.user.email}
                  </span>
                </div>
                <span className="text-body-sm text-text-tertiary">
                  {waitingLabel(row.createdAt)}
                </span>
              </div>
              <p className="text-body-sm text-text-secondary">
                {row.user.email}
              </p>
              {/* What the documents are checked against: the account must
                  be 18 or over, and the birth date must match the card. */}
              <p className="text-body-sm text-text-primary">
                {row.user.dateOfBirth
                  ? t("dateOfBirthLine", {
                      date: formatDate(row.user.dateOfBirth),
                      age: ageOn(row.user.dateOfBirth, new Date(now)),
                    })
                  : t("dateOfBirthMissing")}
              </p>
              <p className="text-body-sm text-text-secondary">
                {t("legalEntityLine", {
                  type: t(`legalEntity.${row.legalEntityType}`),
                })}
              </p>
              {row.legalEntityType !== "INDIVIDUAL" && !row.hasBusinessDoc ? (
                <p
                  role="alert"
                  className="rounded-[var(--fg-radius-md)] border border-warning/30 bg-warning-bg p-3 text-body-sm text-text-primary"
                >
                  {t("businessDocMissing")}
                </p>
              ) : null}
              {row.sameIdAccounts.length > 0 ? (
                <div
                  role="alert"
                  className="rounded-[var(--fg-radius-md)] border border-danger/30 bg-danger-bg p-3 text-body-sm text-text-primary"
                >
                  <p className="font-semibold!">{t("sameIdWarning")}</p>
                  <ul className="mt-1 list-disc pl-5">
                    {row.sameIdAccounts.map((other) => (
                      <li key={`${other.userId}-${other.role}`}>
                        {other.deleted ? (
                          t("sameIdDeletedAccount", {
                            role: roleT(other.role as Role),
                          })
                        ) : (
                          <Link
                            href={`/admin/users/${other.userId}`}
                            className="underline"
                          >
                            {t("sameIdAccount", {
                              name: other.name ?? other.email,
                              email: other.email,
                              role: roleT(other.role as Role),
                            })}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {documents[row.id] ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setDocuments((prev) => {
                        const next = { ...prev };
                        delete next[row.id];
                        return next;
                      })
                    }
                  >
                    <EyeOff className="size-4" />
                    {t("hideDocuments")}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="accent"
                    disabled={loadingImage === `${row.id}-all`}
                    onClick={() => viewAll(row)}
                  >
                    {loadingImage === `${row.id}-all` ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Images className="size-4" />
                    )}
                    {t("viewAllDocuments")}
                  </Button>
                )}
                {IMAGE_KINDS.filter(
                  ({ kind }) => kind !== "business" || row.hasBusinessDoc,
                ).map(({ kind, label }) => (
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

              {documents[row.id] ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {documents[row.id].map((doc) => (
                    <a
                      key={doc.kind}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="focus-ring flex flex-col gap-1.5 rounded-[var(--fg-radius-md)]"
                    >
                      {/* A plain <img>, on purpose: next/image would route an
                          identity document through the image optimiser and
                          its cache. This loads the signed link directly. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={doc.url}
                        alt={doc.label}
                        referrerPolicy="no-referrer"
                        className="max-h-[420px] w-full rounded-[var(--fg-radius-md)] border border-border-subtle bg-bg-sunken object-contain"
                      />
                      <span className="text-body-sm text-text-secondary">
                        {doc.label}
                      </span>
                    </a>
                  ))}
                </div>
              ) : null}

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
