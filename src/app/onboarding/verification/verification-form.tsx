"use client";

import type { Role, VerificationStatus } from "@prisma/client";
import { Loader2, ShieldCheck, UploadCloud } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface KycSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  type: string;
}

function uploadKycFile(file: File, signature: KycSignature) {
  return new Promise<{ secure_url: string; public_id: string }>(
    (resolve, reject) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", signature.apiKey);
      formData.append("timestamp", String(signature.timestamp));
      formData.append("signature", signature.signature);
      formData.append("folder", signature.folder);
      formData.append("type", signature.type);

      const xhr = new XMLHttpRequest();
      xhr.open(
        "POST",
        `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`,
      );
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          // Surface Cloudinary's own error text (e.g. "File size too
          // large", "Invalid Signature") instead of a generic failure —
          // the caller's catch block shows this directly, so a bad
          // upload is diagnosable from the error banner alone instead of
          // requiring browser devtools.
          let reason = `HTTP ${xhr.status}`;
          try {
            reason = JSON.parse(xhr.responseText)?.error?.message ?? reason;
          } catch {
            // Non-JSON response body — keep the HTTP-status fallback above.
          }
          reject(new Error(reason));
        }
      };
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.send(formData);
    },
  );
}

interface SlotProps {
  label: string;
  file: File | null;
  onSelect: (file: File | null) => void;
}

function FileSlot({
  label,
  file,
  onSelect,
  tapToSelectPhoto,
}: SlotProps & { tapToSelectPhoto: string }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Object URLs are only valid client-side and must be revoked when no
  // longer needed (picking a different file, or unmounting) or they leak.
  useEffect(() => {
    if (!file) {
      startTransition(() => setPreviewUrl(null));
      return;
    }
    const url = URL.createObjectURL(file);
    startTransition(() => setPreviewUrl(url));
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-body-sm font-semibold! text-text-primary">
        {label}
      </span>
      <label
        className={cn(
          "relative flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[var(--fg-radius-md)] border-2 border-dashed p-5 text-center transition-colors duration-150 hover:border-brand-primary",
          file ? "border-success" : "border-border-default",
        )}
      >
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
        />
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local blob: object URL, not a remote image next/image can optimize
          <img
            src={previewUrl}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <>
            <UploadCloud className="size-5 text-text-tertiary" />
            <span className="text-body-sm text-text-tertiary">
              {tapToSelectPhoto}
            </span>
          </>
        )}
      </label>
    </div>
  );
}

export function VerificationForm({
  role,
  status,
  rejectedReason,
}: {
  role: Role;
  status: VerificationStatus;
  rejectedReason: string | null;
}) {
  const router = useRouter();
  const roleT = useTranslations("role");
  const t = useTranslations("accountFlows.onboarding.verification.form");
  const [fullName, setFullName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [idFront, setIdFront] = useState<File | null>(null);
  const [idBack, setIdBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (status === "PENDING" && !submitted) {
    return (
      <StatusScreen
        icon={<Loader2 className="size-8 animate-spin text-brand-primary" />}
        title={t("underReviewTitle")}
        description={t("underReviewDesc", { role: roleT(role) })}
        backToDashboard={t("backToDashboard")}
      />
    );
  }

  if (status === "VERIFIED") {
    return (
      <StatusScreen
        icon={<ShieldCheck className="size-8 text-success" />}
        title={t("verifiedTitle")}
        description={t("verifiedDesc", { role: roleT(role) })}
        backToDashboard={t("backToDashboard")}
      />
    );
  }

  if (submitted) {
    return (
      <StatusScreen
        icon={<Loader2 className="size-8 animate-spin text-brand-primary" />}
        title={t("submittedTitle")}
        description={t("underReviewDesc", { role: roleT(role) })}
        backToDashboard={t("backToDashboard")}
      />
    );
  }

  const canSubmit =
    fullName.trim().length >= 2 &&
    idNumber.trim().length > 0 &&
    idFront &&
    idBack &&
    selfie &&
    consent;

  const onSubmit = async () => {
    if (!canSubmit || !idFront || !idBack || !selfie) return;

    setError(null);
    setIsSubmitting(true);
    try {
      const sigRes = await fetch("/api/verification/upload-signature", {
        method: "POST",
      });
      const sigBody = await sigRes.json();
      if (!sigRes.ok) {
        setError(sigBody.message ?? t("uploadsUnavailable"));
        return;
      }

      const [front, back, face] = await Promise.all([
        uploadKycFile(idFront, sigBody.data),
        uploadKycFile(idBack, sigBody.data),
        uploadKycFile(selfie, sigBody.data),
      ]);

      const res = await fetch("/api/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          fullName,
          idNumber,
          idFrontUrl: front.secure_url,
          idFrontPublicId: front.public_id,
          idBackUrl: back.secure_url,
          idBackPublicId: back.public_id,
          selfieUrl: face.secure_url,
          selfiePublicId: face.public_id,
          consentIdentityVerification: consent,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.message ?? t("genericError"));
        return;
      }

      setSubmitted(true);
      router.refresh();
    } catch (err) {
      // uploadKycFile rejects with Cloudinary's own error text when the
      // upload itself is what failed — show that directly rather than a
      // generic message, so a bad file/signature is diagnosable from the
      // banner alone.
      const detail = err instanceof Error ? err.message : null;
      setError(
        detail ? t("uploadFailedDetail", { detail }) : t("uploadFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col gap-6 px-6 py-16">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-display-md text-text-primary">{t("title")}</h1>
        <p className="text-body-md text-text-secondary">
          {t("subtitle", { role: roleT(role) })}
        </p>
      </div>

      {rejectedReason ? (
        <Alert variant="destructive">
          <AlertDescription>
            {t("rejectedNotice", { reason: rejectedReason })}
          </AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="flex flex-col gap-2 text-body-sm text-text-secondary">
        <p>
          <strong className="text-text-primary">{t("whyWeAskLabel")}</strong>{" "}
          {t("whyWeAskBody")}
        </p>
        <p>
          <strong className="text-text-primary">{t("whoCanSeeLabel")}</strong>{" "}
          {t("whoCanSeeBody")}
        </p>
        <p>
          <strong className="text-text-primary">{t("howLongLabel")}</strong>{" "}
          {t("howLongBody")}
        </p>
      </Card>

      <div className="flex flex-col gap-3.5">
        <Input
          label={t("fullLegalNameLabel")}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <Input
          label={t("idNumberLabel")}
          value={idNumber}
          onChange={(e) => setIdNumber(e.target.value)}
          placeholder={t("idNumberPlaceholder")}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FileSlot
            label={t("idFrontLabel")}
            file={idFront}
            onSelect={setIdFront}
            tapToSelectPhoto={t("tapToSelectPhoto")}
          />
          <FileSlot
            label={t("idBackLabel")}
            file={idBack}
            onSelect={setIdBack}
            tapToSelectPhoto={t("tapToSelectPhoto")}
          />
          <FileSlot
            label={t("selfieLabel")}
            file={selfie}
            onSelect={setSelfie}
            tapToSelectPhoto={t("tapToSelectPhoto")}
          />
        </div>

        <Checkbox
          checked={consent}
          onCheckedChange={(checked) => setConsent(checked === true)}
          label={t("consentLabel")}
        />
      </div>

      <Button
        variant="accent"
        size="lg"
        disabled={!canSubmit || isSubmitting}
        onClick={onSubmit}
      >
        {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
        {t("submit")}
      </Button>
      <Button
        variant="ghost"
        nativeButton={false}
        render={<Link href="/dashboard" />}
      >
        {t("doLater")}
      </Button>
    </div>
  );
}

function StatusScreen({
  icon,
  title,
  description,
  backToDashboard,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  backToDashboard: string;
}) {
  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon}
      <h1 className="text-display-md text-text-primary">{title}</h1>
      <p className="text-body-md text-text-secondary">{description}</p>
      <Link href="/dashboard" className="text-text-link hover:underline">
        {backToDashboard}
      </Link>
    </div>
  );
}
