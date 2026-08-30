"use client";

import type { Role, VerificationStatus } from "@prisma/client";
import { Loader2, ShieldCheck, UploadCloud } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

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
          reject(new Error("Upload failed"));
        }
      };
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.send(formData);
    },
  );
}

interface SlotProps {
  label: string;
  file: File | null;
  onSelect: (file: File | null) => void;
}

function FileSlot({ label, file, onSelect }: SlotProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-body-sm font-semibold! text-text-primary">
        {label}
      </span>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[var(--fg-radius-md)] border-2 border-dashed border-border-default p-5 text-center transition-colors duration-150 hover:border-brand-primary">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <span className="text-body-sm font-semibold! text-success">
            {file.name}
          </span>
        ) : (
          <>
            <UploadCloud className="size-5 text-text-tertiary" />
            <span className="text-body-sm text-text-tertiary">
              Tap to select a photo
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
        title="Your submission is under review"
        description={`We're reviewing the ID documents you submitted for ${roleT(role)}. This usually takes 1-2 business days.`}
      />
    );
  }

  if (status === "VERIFIED") {
    return (
      <StatusScreen
        icon={<ShieldCheck className="size-8 text-success" />}
        title="You're verified"
        description={`Your identity has been verified for ${roleT(role)}.`}
      />
    );
  }

  if (submitted) {
    return (
      <StatusScreen
        icon={<Loader2 className="size-8 animate-spin text-brand-primary" />}
        title="Submitted for review"
        description={`We're reviewing the ID documents you submitted for ${roleT(role)}. This usually takes 1-2 business days.`}
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
        setError(
          sigBody.message ?? "Document uploads aren't available right now",
        );
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
        setError(body.message ?? "Something went wrong. Please try again.");
        return;
      }

      setSubmitted(true);
      router.refresh();
    } catch {
      setError("Upload failed. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col gap-6 px-6 py-16">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-display-md text-text-primary">
          Verify your identity
        </h1>
        <p className="text-body-md text-text-secondary">
          Required to activate your {roleT(role)} profile — this is a one-time
          check.
        </p>
      </div>

      {rejectedReason ? (
        <Alert variant="destructive">
          <AlertDescription>
            Your previous submission was rejected: {rejectedReason}. You can
            resubmit below.
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
          <strong className="text-text-primary">Why we ask:</strong> Vietnamese
          e-commerce law (Luật Thương mại điện tử 122/2025) requires
          marketplaces to verify every seller&apos;s identity before they can
          list services.
        </p>
        <p>
          <strong className="text-text-primary">Who can see it:</strong> Only
          Fgrapher admins, only through a short-lived link generated at the
          moment they review your submission — every view is logged.
        </p>
        <p>
          <strong className="text-text-primary">How long we keep it:</strong>{" "}
          Your ID photos are permanently deleted 90 days after approval. We keep
          only the approval record, never the images.
        </p>
      </Card>

      <div className="flex flex-col gap-3.5">
        <Input
          label="Full legal name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <Input
          label="ID number (CCCD/CMND)"
          value={idNumber}
          onChange={(e) => setIdNumber(e.target.value)}
          placeholder="9 or 12 digits"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FileSlot label="ID front" file={idFront} onSelect={setIdFront} />
          <FileSlot label="ID back" file={idBack} onSelect={setIdBack} />
          <FileSlot
            label="Selfie holding ID"
            file={selfie}
            onSelect={setSelfie}
          />
        </div>

        <Checkbox
          checked={consent}
          onCheckedChange={(checked) => setConsent(checked === true)}
          label="I agree to Fgrapher processing my ID document and photo to verify my identity"
        />
      </div>

      <Button
        variant="accent"
        size="lg"
        disabled={!canSubmit || isSubmitting}
        onClick={onSubmit}
      >
        {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
        Submit for review
      </Button>
      <Button
        variant="ghost"
        nativeButton={false}
        render={<Link href="/dashboard" />}
      >
        Do this later
      </Button>
    </div>
  );
}

function StatusScreen({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon}
      <h1 className="text-display-md text-text-primary">{title}</h1>
      <p className="text-body-md text-text-secondary">{description}</p>
      <Link href="/dashboard" className="text-text-link hover:underline">
        Back to dashboard
      </Link>
    </div>
  );
}
