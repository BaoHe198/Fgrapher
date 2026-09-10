"use client";

import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { startTransition, useEffect, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PanelState =
  | "verifying"
  | "verified"
  | "already_verified"
  | "expired"
  | "invalid"
  | "missing_token";

interface VerifyEmailPanelProps {
  token: string | null;
  initialEmail: string;
}

export function VerifyEmailPanel({
  token,
  initialEmail,
}: VerifyEmailPanelProps) {
  const t = useTranslations("accountFlows.verifyEmail");
  const [state, setState] = useState<PanelState>(
    token ? "verifying" : "missing_token",
  );

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return;
        // startTransition keeps this out of the set-state-in-effect lint
        // rule and matches how the rest of the app fetches from effects.
        startTransition(() => {
          const status = body?.data?.status;
          setState(
            status === "verified" ||
              status === "already_verified" ||
              status === "expired"
              ? status
              : "invalid",
          );
        });
      })
      .catch(() => {
        if (cancelled) return;
        startTransition(() => setState("invalid"));
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === "verifying") {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="size-8 animate-spin text-brand-primary" />
        <p className="text-body-md text-text-secondary">{t("verifying")}</p>
      </div>
    );
  }

  if (state === "verified" || state === "already_verified") {
    const isFresh = state === "verified";
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle className="size-10 text-brand-primary" />
        <h1 className="text-display-md text-text-primary">
          {isFresh ? t("successTitle") : t("alreadyTitle")}
        </h1>
        <p className="text-body-md text-text-secondary">
          {isFresh ? t("successBody") : t("alreadyBody")}
        </p>
        <Link
          href="/login"
          className={cn(
            buttonVariants({ variant: "accent", size: "lg" }),
            "w-full",
          )}
        >
          {t("goToLogin")}
        </Link>
      </div>
    );
  }

  // A missing token and a wrong one are the same problem to the reader —
  // the link didn't work — so they share a heading and differ only in the
  // explanation.
  const titleKey = state === "expired" ? "expiredTitle" : "invalidTitle";
  const bodyKey =
    state === "expired"
      ? "expiredBody"
      : state === "missing_token"
        ? "missingToken"
        : "invalidBody";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertCircle className="size-10 text-danger" />
        <h1 className="text-display-md text-text-primary">{t(titleKey)}</h1>
        <p className="text-body-md text-text-secondary">{t(bodyKey)}</p>
      </div>

      <ResendVerificationForm initialEmail={initialEmail} />

      <p className="text-center text-body-md text-text-secondary">
        <Link
          href="/login"
          className="font-semibold text-text-link hover:underline"
        >
          {t("goToLogin")}
        </Link>
      </p>
    </div>
  );
}

interface ResendVerificationFormProps {
  initialEmail: string;
  compact?: boolean;
}

/**
 * Requests a new verification link. Shared by this page and the login
 * form's unverified-account prompt.
 *
 * The button is disabled while in flight and stays disabled after a
 * successful request. Issuing a link invalidates the previous one, so
 * letting someone fire several in a row would hand them an inbox of dead
 * links — see the copy, which points them at the most recent email.
 */
export function ResendVerificationForm({
  initialEmail,
  compact = false,
}: ResendVerificationFormProps) {
  const t = useTranslations("accountFlows.verifyEmail");
  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (status === "sending" || status === "sent") return;

    setStatus("sending");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  };

  if (status === "sent") {
    return (
      <p className="rounded-[var(--fg-radius-md)] bg-success-bg p-3 text-body-sm text-text-secondary">
        {t("resendSent")}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {/* Shown in both layouts: NextAuth redirects on a failed sign-in, so
          by the time the login page renders this prompt the address the
          user typed is gone and has to be entered again. */}
      <Input
        label={compact ? undefined : t("emailLabel")}
        aria-label={compact ? t("emailLabel") : undefined}
        type="email"
        required
        autoComplete="email"
        placeholder="you@studio.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      {status === "error" ? (
        <p className="rounded-[var(--fg-radius-md)] bg-danger-bg p-3 text-body-sm text-danger">
          {t("resendFailed")}
        </p>
      ) : null}

      <Button
        type="submit"
        variant={compact ? "secondary" : "accent"}
        size={compact ? "sm" : "lg"}
        className={compact ? "self-start" : "w-full"}
        disabled={status === "sending" || email.trim().length === 0}
      >
        {status === "sending" ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {t("resending")}
          </>
        ) : (
          t("resend")
        )}
      </Button>
    </form>
  );
}
