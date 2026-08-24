"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { SocialRow } from "@/components/auth/social-row";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";

interface LoginFormProps {
  callbackUrl?: string;
  hasError: boolean;
  onSwitchToRegister: () => void;
}

export function LoginForm({
  callbackUrl,
  hasError,
  onSwitchToRegister,
}: LoginFormProps) {
  const t = useTranslations("accountFlows.login");
  const [serverError, setServerError] = useState<string | null>(
    hasError ? t("invalidCredentials") : null,
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginInput) => {
    setServerError(null);

    // redirect: true (the default) lets next-auth navigate directly rather than
    // resolving the client-side promise itself — the latter awaits an internal
    // session re-fetch that has been observed to hang indefinitely in production.
    await signIn("credentials", {
      email: values.email,
      password: values.password,
      callbackUrl: callbackUrl || "/dashboard",
    });
  };

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
        <Input
          label={t("passwordLabel")}
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />

        <div className="flex items-center justify-between">
          <Checkbox label={t("rememberMe")} defaultChecked />
          <Link
            href="/forgot-password"
            className="text-body-sm font-semibold text-text-link hover:underline"
          >
            {t("forgotPassword")}
          </Link>
        </div>

        <Button
          type="submit"
          variant="accent"
          size="lg"
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t("submitting")}
            </>
          ) : (
            t("submit")
          )}
        </Button>
      </form>

      <SocialRow />

      <p className="text-body-sm text-text-tertiary">{t("terms")}</p>

      <p className="text-body-md text-text-secondary">
        {t("noAccount")}{" "}
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="font-semibold text-text-link hover:underline"
        >
          {t("signUp")}
        </button>
      </p>
    </>
  );
}
