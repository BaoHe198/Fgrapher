"use client";

import type { PlaceOperatingStatus } from "@prisma/client";
import { Check, Loader2, Star, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  type NewPlacePhoto,
  PlacePhotoField,
} from "@/components/places/place-photo-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";

// The admin's controls on a spot's review page. Each posts to one admin
// route and refreshes the page, which re-reads everything from the server.

function useAdminCall() {
  const t = useTranslations("places.admin");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const call = async (
    key: string,
    url: string,
    method: string,
    body?: unknown,
    after?: (data: { id?: string } | null) => void,
  ) => {
    setBusy(key);
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBusy(null);
    toast.add({
      title: json?.message ?? (res?.ok ? t("done") : t("failed")),
      type: res?.ok ? "success" : "error",
    });
    if (res?.ok) {
      if (after) after(json?.data ?? null);
      else router.refresh();
    }
    return Boolean(res?.ok);
  };
  return { busy, call };
}

export function PlaceReviewPanel({ placeId }: { placeId: string }) {
  const t = useTranslations("places.admin");
  const { busy, call } = useAdminCall();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-body-sm text-text-secondary">{t("approveHint")}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={busy !== null}
          onClick={() =>
            call("approve", `/api/admin/places/${placeId}/review`, "POST", {
              action: "approve",
            })
          }
        >
          {busy === "approve" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Check />
          )}
          {t("approve")}
        </Button>
        <Button
          variant="secondary"
          disabled={busy !== null}
          onClick={() => setRejecting((open) => !open)}
          aria-expanded={rejecting}
        >
          <X />
          {t("reject")}
        </Button>
      </div>
      {rejecting ? (
        <div className="flex flex-col gap-2">
          <Textarea
            label={t("rejectReason")}
            value={reason}
            maxLength={500}
            rows={3}
            onChange={(e) => setReason(e.target.value)}
            error={error ?? undefined}
          />
          <Button
            variant="destructive"
            className="self-start"
            disabled={busy !== null}
            onClick={() => {
              if (reason.trim().length < 5) {
                setError(t("rejectReasonTooShort"));
                return;
              }
              setError(null);
              void call(
                "reject",
                `/api/admin/places/${placeId}/review`,
                "POST",
                {
                  action: "reject",
                  reason: reason.trim(),
                },
              );
            }}
          >
            {busy === "reject" ? <Loader2 className="animate-spin" /> : null}
            {t("reject")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function PlaceStatusPanel({
  placeId,
  operatingStatus,
  statusNote,
}: {
  placeId: string;
  operatingStatus: PlaceOperatingStatus;
  statusNote: string | null;
}) {
  const t = useTranslations("places.admin");
  const statusT = useTranslations("places.status");
  const { busy, call } = useAdminCall();
  const [status, setStatus] = useState(operatingStatus);
  const [note, setNote] = useState(statusNote ?? "");
  const [verified, setVerified] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <NativeSelect
        label={t("operatingStatus")}
        value={status}
        onChange={(value) => setStatus(value as PlaceOperatingStatus)}
        options={(["OPEN", "TEMPORARILY_CLOSED", "NO_SHOOTING"] as const).map(
          (value) => ({ value, label: statusT(value) }),
        )}
      />
      <Input
        label={t("statusNote")}
        placeholder={t("statusNotePlaceholder")}
        value={note}
        maxLength={300}
        onChange={(e) => setNote(e.target.value)}
      />
      <Checkbox
        checked={verified}
        onCheckedChange={(checked) => setVerified(checked === true)}
        label={t("markVerified")}
      />
      <Button
        variant="secondary"
        className="self-start"
        disabled={busy !== null}
        onClick={() =>
          call("status", `/api/admin/places/${placeId}`, "PATCH", {
            operatingStatus: status,
            statusNote: note,
            markVerified: verified,
          })
        }
      >
        {busy === "status" ? <Loader2 className="animate-spin" /> : null}
        {t("saveStatus")}
      </Button>
    </div>
  );
}

export function PlacePhotosPanel({
  placeId,
  coverMediaId,
  photos,
}: {
  placeId: string;
  coverMediaId: string | null;
  photos: {
    id: string;
    url: string;
    moderationStatus: "PENDING" | "APPROVED" | "REJECTED" | "AUTO_REJECTED";
  }[];
}) {
  const t = useTranslations("places.admin");
  const formT = useTranslations("places.form");
  const { busy, call } = useAdminCall();
  const [adding, setAdding] = useState<NewPlacePhoto[]>([]);
  const [rights, setRights] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((photo) => (
          <li
            key={photo.id}
            className="flex flex-col gap-2 rounded-[var(--fg-radius-md)] border border-border-subtle p-2"
          >
            <a
              href={photo.url}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- admin review thumbnail */}
              <img
                src={photo.url}
                alt=""
                className="aspect-[4/3] w-full rounded-[var(--fg-radius-sm)] object-cover"
              />
            </a>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant={
                  photo.moderationStatus === "APPROVED"
                    ? "success"
                    : photo.moderationStatus === "PENDING"
                      ? "neutral"
                      : "destructive"
                }
              >
                {t(`photoStatus.${photo.moderationStatus}`)}
              </Badge>
              {photo.id === coverMediaId ? (
                <Badge variant="accent">
                  <Star aria-hidden />
                  {t("isCover")}
                </Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {photo.moderationStatus !== "APPROVED" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() =>
                    call(
                      `a-${photo.id}`,
                      `/api/admin/places/${placeId}/media`,
                      "POST",
                      {
                        action: "approve",
                        mediaIds: [photo.id],
                      },
                    )
                  }
                >
                  {t("approvePhoto")}
                </Button>
              ) : null}
              {photo.moderationStatus !== "REJECTED" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={() =>
                    call(
                      `r-${photo.id}`,
                      `/api/admin/places/${placeId}/media`,
                      "POST",
                      {
                        action: "reject",
                        mediaIds: [photo.id],
                      },
                    )
                  }
                >
                  {t("rejectPhoto")}
                </Button>
              ) : null}
              {photo.moderationStatus === "APPROVED" &&
              photo.id !== coverMediaId ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={() =>
                    call(
                      `c-${photo.id}`,
                      `/api/admin/places/${placeId}/media`,
                      "POST",
                      {
                        action: "cover",
                        mediaId: photo.id,
                      },
                    )
                  }
                >
                  {t("makeCover")}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 border-t border-border-subtle pt-4">
        <p className="text-body-sm font-semibold text-text-primary">
          {t("addPhotos")}
        </p>
        <PlacePhotoField
          existing={[]}
          onExistingChange={() => {}}
          value={adding}
          onChange={setAdding}
          max={30}
          hint={t("addPhotosHint")}
        />
        {adding.length > 0 ? (
          <>
            <Checkbox
              checked={rights}
              onCheckedChange={(checked) => setRights(checked === true)}
              label={formT("rights")}
            />
            <Button
              variant="secondary"
              className="self-start"
              disabled={busy !== null || !rights}
              onClick={async () => {
                const ok = await call(
                  "add",
                  `/api/admin/places/${placeId}/media`,
                  "POST",
                  {
                    action: "add",
                    photos: adding,
                    rightsConfirmed: true,
                  },
                );
                if (ok) {
                  setAdding([]);
                  setRights(false);
                }
              }}
            >
              {busy === "add" ? <Loader2 className="animate-spin" /> : null}
              {t("addPhotos")}
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function PlaceMergeButton({
  placeId,
  placeName,
  into,
}: {
  placeId: string;
  placeName: string;
  into: { id: string; name: string };
}) {
  const t = useTranslations("places.admin");
  const router = useRouter();
  const { busy, call } = useAdminCall();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={busy !== null}
      onClick={() => {
        if (
          !window.confirm(
            t("mergeConfirm", { from: placeName, into: into.name }),
          )
        ) {
          return;
        }
        void call(
          "merge",
          `/api/admin/places/${placeId}/merge`,
          "POST",
          {
            intoPlaceId: into.id,
          },
          () => router.push(`/admin/places/${into.id}`),
        );
      }}
    >
      {busy === "merge" ? <Loader2 className="animate-spin" /> : null}
      {t("mergeInto")}
    </Button>
  );
}

export function PlaceDeleteButton({
  placeId,
  placeName,
}: {
  placeId: string;
  placeName: string;
}) {
  const t = useTranslations("places.admin");
  const router = useRouter();
  const { busy, call } = useAdminCall();
  return (
    <Button
      variant="destructive"
      disabled={busy !== null}
      onClick={() => {
        if (!window.confirm(t("deleteConfirm", { name: placeName }))) return;
        void call(
          "delete",
          `/api/admin/places/${placeId}`,
          "DELETE",
          undefined,
          () => router.push("/admin/places"),
        );
      }}
    >
      {busy === "delete" ? <Loader2 className="animate-spin" /> : null}
      {t("delete")}
    </Button>
  );
}
