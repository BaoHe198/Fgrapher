"use client";

import type { Role, VerificationStatus } from "@prisma/client";
import { Clock, Loader2, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";

import { NativeSelect } from "@/components/ui/native-select";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PROVIDER_ROLES } from "@/lib/constants";
import { compressImageFile } from "@/lib/media/image-compression";
import { cn } from "@/lib/utils";

interface KycSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  type: string;
  allowedFormats: string;
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
      formData.append("allowed_formats", signature.allowedFormats);

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

// Stays safely under Cloudinary's free-plan 10MB single-upload cap (see
// generateKycUploadSignature's caller) — a full-resolution phone camera
// photo routinely exceeds that, and 2400px on the long edge is already
// far more than a reviewer needs to read an ID card's text.
const MAX_KYC_BYTES = 8 * 1024 * 1024;
const MAX_KYC_DIMENSION = 2400;

function compressKycFile(file: File): Promise<File> {
  return compressImageFile(file, {
    maxBytes: MAX_KYC_BYTES,
    maxDimension: MAX_KYC_DIMENSION,
  });
}

type SlotKind = "front" | "back" | "selfie" | "paper";

interface SlotProps {
  label: string;
  file: File | null;
  onSelect: (file: File | null) => void;
  /** Which outline to draw in the empty tile, as an example of the photo. */
  kind: SlotKind;
}

// What the photo should look like, drawn rather than described: the whole
// card inside the frame, or a face with the card held beside it.
function SlotExample({ kind }: { kind: SlotKind }) {
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg
      viewBox="0 0 96 64"
      aria-hidden
      className="h-14 w-auto text-text-tertiary"
    >
      {kind === "selfie" ? (
        <>
          <circle cx="36" cy="22" r="11" {...stroke} />
          <path d="M14 60c2-14 10-21 22-21s20 7 22 21" {...stroke} />
          <rect x="58" y="30" width="30" height="20" rx="3" {...stroke} />
          <path d="M63 37h8M63 43h18" {...stroke} />
        </>
      ) : kind === "paper" ? (
        <>
          <rect x="24" y="4" width="48" height="56" rx="3" {...stroke} />
          <path d="M33 16h30M33 26h30M33 36h30M33 46h18" {...stroke} />
        </>
      ) : (
        <>
          <rect x="6" y="6" width="84" height="52" rx="5" {...stroke} />
          {kind === "front" ? (
            <>
              <rect x="14" y="18" width="22" height="28" rx="2" {...stroke} />
              <path d="M44 22h36M44 32h36M44 42h24" {...stroke} />
            </>
          ) : (
            <>
              <rect x="14" y="16" width="16" height="12" rx="2" {...stroke} />
              <path d="M14 38h68M14 48h68M40 22h42" {...stroke} />
            </>
          )}
        </>
      )}
    </svg>
  );
}

function FileSlot({
  label,
  file,
  onSelect,
  kind,
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
    // justify-end: a label that wraps to two lines ("Ảnh chân dung cầm giấy
    // tờ") must not push its tile below the other two.
    <div className="flex h-full flex-col justify-end gap-1.5">
      <span className="text-body-sm font-semibold! text-text-primary">
        {label}
      </span>
      <label
        className={cn(
          "relative flex aspect-[3/2] cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[var(--fg-radius-md)] border-2 border-dashed bg-bg-sunken p-3 text-center transition-colors duration-150 hover:border-brand-primary",
          file ? "border-success" : "border-border-default",
        )}
      >
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={async (e) => {
            const picked = e.target.files?.[0] ?? null;
            onSelect(picked ? await compressKycFile(picked) : null);
          }}
        />
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local blob: object URL, not a remote image next/image can optimize
          <img
            src={previewUrl}
            alt=""
            className="absolute inset-0 size-full object-contain"
          />
        ) : (
          <>
            <SlotExample kind={kind} />
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
  accountName,
}: {
  role: Role;
  status: VerificationStatus;
  rejectedReason: string | null;
  /** The account holder's name, offered as the name on the document. */
  accountName: string | null;
}) {
  const router = useRouter();
  const roleT = useTranslations("role");
  const t = useTranslations("accountFlows.onboarding.verification.form");
  const [fullName, setFullName] = useState(accountName ?? "");
  const [idNumber, setIdNumber] = useState("");
  const [idFront, setIdFront] = useState<File | null>(null);
  const [idBack, setIdBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  // Freelance individual is the default because it is both the common case
  // and the one that owes no extra paperwork (project owner, 22/09/2026).
  const [legalEntityType, setLegalEntityType] = useState<
    "INDIVIDUAL" | "HOUSEHOLD_BUSINESS" | "COMPANY"
  >("INDIVIDUAL");
  const [businessDoc, setBusinessDoc] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // A still clock, not a spinner: a spinner says "loading, wait here", and
  // people did wait (role walk-through, 25/11/2026). A review takes a day
  // or two; the screen says so and offers what can be done meanwhile.
  const waitingIcon = (
    <span className="flex size-14 items-center justify-center rounded-full bg-gold-100">
      <Clock aria-hidden className="size-7 text-gold-700" />
    </span>
  );
  const meanwhile = [
    { href: "/dashboard/portfolio", label: t("meanwhile.photos") },
    ...((PROVIDER_ROLES as readonly string[]).includes(role)
      ? [{ href: "/dashboard/services", label: t("meanwhile.services") }]
      : []),
    { href: "/dashboard/my-page/info", label: t("meanwhile.info") },
  ];

  if (status === "PENDING" && !submitted) {
    return (
      <StatusScreen
        icon={waitingIcon}
        title={t("underReviewTitle")}
        description={t("underReviewDesc", { role: roleT(role) })}
        backToDashboard={t("backToDashboard")}
        meanwhileTitle={t("meanwhile.title")}
        meanwhile={meanwhile}
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
        icon={waitingIcon}
        title={t("submittedTitle")}
        description={t("underReviewDesc", { role: roleT(role) })}
        backToDashboard={t("backToDashboard")}
        meanwhileTitle={t("meanwhile.title")}
        meanwhile={meanwhile}
      />
    );
  }

  const needsBusinessDoc = legalEntityType !== "INDIVIDUAL";
  const canSubmit =
    fullName.trim().length >= 2 &&
    idNumber.trim().length > 0 &&
    idFront &&
    idBack &&
    selfie &&
    (!needsBusinessDoc || businessDoc) &&
    consent;
  // First missing piece, said out loud — a greyed-out submit alone left
  // people hunting for what was left (24/09 audit).
  const missingHint = canSubmit
    ? null
    : fullName.trim().length < 2
      ? t("missingHint.name")
      : !idNumber.trim()
        ? t("missingHint.idNumber")
        : !idFront || !idBack || !selfie
          ? t("missingHint.photos")
          : needsBusinessDoc && !businessDoc
            ? t("missingHint.businessDoc")
            : t("missingHint.consent");

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

      const [front, back, face, businessDocUpload] = await Promise.all([
        uploadKycFile(idFront, sigBody.data),
        uploadKycFile(idBack, sigBody.data),
        uploadKycFile(selfie, sigBody.data),
        businessDoc
          ? uploadKycFile(businessDoc, sigBody.data)
          : Promise.resolve(null),
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
          legalEntityType,
          businessDocUrl: businessDocUpload?.secure_url,
          businessDocPublicId: businessDocUpload?.public_id,
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
        <NativeSelect
          label={t("legalEntityLabel")}
          options={[
            { value: "INDIVIDUAL", label: t("legalEntityIndividual") },
            { value: "HOUSEHOLD_BUSINESS", label: t("legalEntityHousehold") },
            { value: "COMPANY", label: t("legalEntityCompany") },
          ]}
          value={legalEntityType}
          onChange={(value) =>
            setLegalEntityType(
              value as "INDIVIDUAL" | "HOUSEHOLD_BUSINESS" | "COMPANY",
            )
          }
        />
        {needsBusinessDoc ? (
          <div className="flex flex-col gap-2">
            <FileSlot
              label={t("businessDocLabel")}
              kind="paper"
              file={businessDoc}
              onSelect={setBusinessDoc}
              tapToSelectPhoto={t("tapToSelectPhoto")}
            />
            <p className="text-body-sm text-text-tertiary">
              {t("businessDocHelp")}
            </p>
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FileSlot
            label={t("idFrontLabel")}
            kind="front"
            file={idFront}
            onSelect={setIdFront}
            tapToSelectPhoto={t("tapToSelectPhoto")}
          />
          <FileSlot
            label={t("idBackLabel")}
            kind="back"
            file={idBack}
            onSelect={setIdBack}
            tapToSelectPhoto={t("tapToSelectPhoto")}
          />
          <FileSlot
            label={t("selfieLabel")}
            kind="selfie"
            file={selfie}
            onSelect={setSelfie}
            tapToSelectPhoto={t("tapToSelectPhoto")}
          />
        </div>
        <p className="text-body-sm text-text-tertiary">{t("photoTips")}</p>

        <Checkbox
          checked={consent}
          onCheckedChange={(checked) => setConsent(checked === true)}
          label={t("consentLabel")}
        />
      </div>

      {/* Next to the button that failed: at the top of this long form the
          error was off-screen and submit looked like it did nothing. */}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button
        variant="accent"
        size="lg"
        disabled={!canSubmit || isSubmitting}
        onClick={onSubmit}
      >
        {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
        {t("submit")}
      </Button>
      {missingHint ? (
        <p className="-mt-2 text-center text-body-sm text-text-tertiary">
          {missingHint}
        </p>
      ) : null}
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
  meanwhileTitle,
  meanwhile = [],
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  backToDashboard: string;
  meanwhileTitle?: string;
  meanwhile?: { href: string; label: string }[];
}) {
  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon}
      <h1 className="text-display-md text-text-primary">{title}</h1>
      <p className="text-body-md text-text-secondary">{description}</p>
      {meanwhile.length > 0 ? (
        <div className="mt-2 flex w-full flex-col gap-2 text-left">
          <span className="text-body-sm font-semibold! text-text-primary">
            {meanwhileTitle}
          </span>
          {meanwhile.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="focus-ring flex min-h-12 items-center justify-between gap-3 rounded-[var(--fg-radius-md)] border border-border-default px-4 text-body-md text-text-primary hover:bg-bg-sunken"
            >
              {item.label}
              <span aria-hidden className="text-text-tertiary">
                →
              </span>
            </Link>
          ))}
        </div>
      ) : null}
      <Link href="/dashboard" className="text-text-link hover:underline">
        {backToDashboard}
      </Link>
    </div>
  );
}
