"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ForgotPasswordInput = { email: string };

export function ForgotPasswordForm() {
  const t = useTranslations("accountFlows.forgotPassword");
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);

  const forgotPasswordSchema = z.object({
    email: z.string().email(t("emailInvalid")),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: ForgotPasswordInput) => {
    setServerError(null);

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      const body = await res.json();
      setServerError(body.message ?? t("genericError"));
      return;
    }

    setIsSent(true);
  };

  if (isSent) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle className="size-10 text-brand-primary" />
        <h1 className="text-display-md text-text-primary">
          {t("checkInboxTitle")}
        </h1>
        <p className="text-body-md text-text-secondary">
          {t("checkInboxBody")}
        </p>
        <Link
          href="/login"
          className="text-body-sm font-semibold text-text-link hover:underline"
        >
          {t("backToSignIn")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-display-md text-text-primary">{t("title")}</h1>
        <p className="text-body-md text-text-secondary">{t("subtitle")}</p>
      </div>

      {serverError ? (
        <div className="rounded-[var(--fg-radius-md)] bg-danger-bg p-3 text-body-sm text-danger">
          {serverError}
        </div>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
        <Input
          label={t("emailLabel")}
          type="email"
          placeholder="you@studio.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />

        <Button
          type="submit"
          variant="accent"
          size="lg"
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            t("submit")
          )}
        </Button>
      </form>

      <p className="text-body-md text-text-secondary">
        <Link
          href="/login"
          className="font-semibold text-text-link hover:underline"
        >
          {t("backToSignIn")}
        </Link>
      </p>
    </>
  );
}
