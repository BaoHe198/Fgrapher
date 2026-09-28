"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { useMounted } from "@/hooks/use-mounted";

type ResetPasswordInput = { password: string; confirmPassword: string };

export function ResetPasswordForm() {
  // Until hydration the form is plain HTML: a click then would submit it
  // natively, and the default GET put every field — the password included —
  // into the URL, browser history and server logs. POST keeps them out of
  // the URL, and Submit stays disabled until React owns the form.
  const mounted = useMounted();
  const t = useTranslations("accountFlows.resetPassword");
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [serverError, setServerError] = useState<string | null>(null);

  const resetPasswordSchema = z
    .object({
      password: z.string().min(8, t("passwordMinLength")),
      confirmPassword: z.string().min(1, t("confirmRequired")),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("passwordsMismatch"),
      path: ["confirmPassword"],
    });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    // No defaultValues on purpose: with them, registering each input on
    // hydration reset it to "", wiping whatever was typed before the page
    // became interactive (slow phones; the e2e suite). Without them the
    // form adopts the value already in the field.
  });

  const onSubmit = async (values: ResetPasswordInput) => {
    setServerError(null);

    if (!token) {
      setServerError(t("invalidLink"));
      return;
    }

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: values.password }),
    });

    if (!res.ok) {
      const body = await res.json();
      setServerError(body.message ?? t("genericError"));
      return;
    }

    toast.add({
      title: t("updatedToastTitle"),
      description: t("updatedToastDesc"),
      type: "success",
    });
    router.push("/login");
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-display-md text-text-primary">{t("title")}</h1>
      </div>

      {serverError ? (
        <div className="rounded-[var(--fg-radius-md)] bg-danger-bg p-3 text-body-sm text-danger">
          {serverError}
        </div>
      ) : null}

      <form
        method="post"
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-3.5"
      >
        <Input
          label={t("newPasswordLabel")}
          type="password"
          placeholder={t("passwordPlaceholder")}
          autoComplete="new-password"
          error={errors.password?.message}
          {...register("password")}
        />
        <Input
          label={t("confirmPasswordLabel")}
          type="password"
          placeholder={t("passwordPlaceholder")}
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />

        <Button
          type="submit"
          variant="accent"
          size="lg"
          className="w-full"
          disabled={isSubmitting || !mounted}
        >
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            t("submit")
          )}
        </Button>
      </form>
    </>
  );
}
