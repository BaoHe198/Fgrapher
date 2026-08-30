"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface PhoneVerifyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  onVerified: (verifiedPhone: string) => void;
}

export function PhoneVerifyDialog({
  open,
  onOpenChange,
  phone,
  onVerified,
}: PhoneVerifyDialogProps) {
  const t = useTranslations("sharedComponents.phoneVerifyDialog");
  const [step, setStep] = useState<"send" | "code">("send");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [devHint, setDevHint] = useState<string | null>(null);

  const reset = () => {
    setStep("send");
    setCode("");
    setError(null);
    setDevHint(null);
  };

  const sendCode = async () => {
    setError(null);
    setIsSending(true);
    const res = await fetch("/api/phone/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const body = await res.json();
    setIsSending(false);

    if (!res.ok) {
      setError(body.message ?? t("genericError"));
      return;
    }

    setDevHint(body.data?.devHint ?? null);
    setStep("code");
  };

  const verifyCode = async () => {
    setError(null);
    setIsVerifying(true);
    const res = await fetch("/api/phone/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code }),
    });
    const body = await res.json();
    setIsVerifying(false);

    if (!res.ok) {
      setError(body.message ?? t("genericError"));
      return;
    }

    onVerified(body.data.phone);
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        {step === "send" ? (
          <div className="flex flex-col gap-3">
            <p className="text-body-sm text-text-secondary">
              {t("sendDescription", { phone })}
            </p>
            {error ? <p className="text-body-sm text-danger">{error}</p> : null}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-body-sm text-text-secondary">
              {t("codeDescription", { phone })}
            </p>
            {devHint ? (
              <p className="text-body-sm font-semibold! text-warning">
                {t("devHint", { code: devHint })}
              </p>
            ) : null}
            <Input
              label={t("codeLabel")}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoFocus
            />
            {error ? <p className="text-body-sm text-danger">{error}</p> : null}
            <button
              type="button"
              onClick={sendCode}
              disabled={isSending}
              className="self-start text-body-sm font-semibold! text-text-link"
            >
              {t("resend")}
            </button>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          {step === "send" ? (
            <Button variant="accent" disabled={isSending} onClick={sendCode}>
              {isSending ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("sendCode")}
            </Button>
          ) : (
            <Button
              variant="accent"
              disabled={isVerifying || code.length < 4}
              onClick={verifyCode}
            >
              {isVerifying ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("verify")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
