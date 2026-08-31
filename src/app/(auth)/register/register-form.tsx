"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Loader2, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { SocialRow } from "@/components/auth/social-row";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Radio } from "@/components/ui/radio";
import { PAID_ROLES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  getRegisterSchema,
  type ProviderRole,
  type RegisterInput,
} from "@/lib/validations/auth";

// CAMERA_SHOP is filtered out per-instance below when MARKETPLACE_ENABLED
// is off — kept in PAID_ROLES/the Role enum itself so existing data (and
// re-enabling the flag) never breaks.
const ALL_PROVIDER_ROLE_OPTIONS = PAID_ROLES as ProviderRole[];

function passwordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

function strengthColor(score: number) {
  if (score <= 1) return "bg-danger";
  if (score <= 2) return "bg-warning";
  return "bg-success";
}

interface RegisterFormProps {
  interval: "month" | "year";
  initialRole?: string;
  onSwitchToLogin: () => void;
  marketplaceEnabled: boolean;
}

export function RegisterForm({
  interval,
  initialRole,
  onSwitchToLogin,
  marketplaceEnabled,
}: RegisterFormProps) {
  const t = useTranslations("accountFlows.register");
  const roleT = useTranslations("role");
  const tValidation = useTranslations("libServices.validation.auth");
  const registerSchema = useMemo(
    () => getRegisterSchema(tValidation),
    [tValidation],
  );
  const PROVIDER_ROLE_OPTIONS = marketplaceEnabled
    ? ALL_PROVIDER_ROLE_OPTIONS
    : ALL_PROVIDER_ROLE_OPTIONS.filter((role) => role !== "CAMERA_SHOP");
  // e.g. arriving from the pricing page's "Start 14-day trial" on a
  // specific role's card (/login?mode=register&role=PHOTOGRAPHER) —
  // pre-select "Creative pro" and that role rather than making the user
  // redo a choice they already made.
  const preselectedRole =
    initialRole && (PROVIDER_ROLE_OPTIONS as string[]).includes(initialRole)
      ? (initialRole as ProviderRole)
      : null;

  const [serverError, setServerError] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<"customer" | "provider">(
    preselectedRole ? "provider" : "customer",
  );
  const [selectedRoles, setSelectedRoles] = useState<Set<ProviderRole>>(
    preselectedRole ? new Set([preselectedRole]) : new Set(),
  );

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      accountType: preselectedRole ? "provider" : "customer",
      roles: preselectedRole ? [preselectedRole] : [],
      // Never pre-ticked — each is its own separate, explicit choice.
      consentService: false,
      consentMarketing: false,
      consentAnalytics: false,
    },
  });

  const password = watch("password");
  const strength = useMemo(() => passwordStrength(password ?? ""), [password]);
  const isModelSelected = selectedRoles.has("MODEL" as ProviderRole);

  const selectAccountType = (next: "customer" | "provider") => {
    setAccountType(next);
    setValue("accountType", next);
    if (next === "customer") {
      setSelectedRoles(new Set());
      setValue("roles", []);
    }
  };

  // MVP scope decision — one provider role per account (CLAUDE.md). Picking
  // a role replaces whatever was selected before rather than adding to it.
  const toggleRole = (role: ProviderRole) => {
    setSelectedRoles((prev) => {
      const next = prev.has(role) ? new Set<ProviderRole>() : new Set([role]);
      setValue("roles", Array.from(next));
      return next;
    });
  };

  const onSubmit = async (values: RegisterInput) => {
    setServerError(null);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const body = await res.json();

    if (!res.ok) {
      if (body.error === "email_taken") {
        setError("email", { message: body.message });
        return;
      }
      setServerError(body.message ?? t("genericError"));
      return;
    }

    const paidRoles = values.roles.filter((role) =>
      (PAID_ROLES as string[]).includes(role),
    );
    const callbackUrl =
      paidRoles.length > 0
        ? `/onboarding/billing?roles=${paidRoles.join(",")}&interval=${interval}`
        : "/dashboard";

    // redirect: true (the default) lets next-auth navigate directly rather than
    // resolving the client-side promise itself — the latter awaits an internal
    // session re-fetch that has been observed to hang indefinitely in production.
    // On failure this redirects to /login?error=CredentialsSignin.
    await signIn("credentials", {
      email: values.email,
      password: values.password,
      callbackUrl,
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
        <div className="flex flex-col gap-2">
          <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
            {t("iAmA")}
          </span>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => selectAccountType("customer")}
              className={cn(
                "flex cursor-pointer flex-col gap-1.5 rounded-[var(--fg-radius-md)] p-3.5 text-left transition-colors duration-150",
                accountType === "customer"
                  ? "border border-brand-primary bg-success-bg"
                  : "border border-border-default bg-bg-surface",
              )}
            >
              <User
                className={cn(
                  "size-5",
                  accountType === "customer"
                    ? "text-brand-primary"
                    : "text-text-tertiary",
                )}
              />
              <span className="text-body-md font-semibold! text-text-primary">
                {t("customerLabel")}
              </span>
              <span className="text-body-sm text-text-secondary">
                {t("customerDesc")}
              </span>
            </button>

            <button
              type="button"
              onClick={() => selectAccountType("provider")}
              className={cn(
                "flex cursor-pointer flex-col gap-1.5 rounded-[var(--fg-radius-md)] p-3.5 text-left transition-colors duration-150",
                accountType === "provider"
                  ? "border border-brand-primary bg-success-bg"
                  : "border border-border-default bg-bg-surface",
              )}
            >
              <Camera
                className={cn(
                  "size-5",
                  accountType === "provider"
                    ? "text-brand-primary"
                    : "text-text-tertiary",
                )}
              />
              <span className="text-body-md font-semibold! text-text-primary">
                {t("providerLabel")}
              </span>
              <span className="text-body-sm text-text-secondary">
                {t("providerDesc")}
              </span>
            </button>
          </div>
        </div>

        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-out",
            accountType === "provider" ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="flex flex-col gap-2 overflow-hidden">
            <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
              {t("whatDoYouOffer")}
            </span>
            <div className="flex flex-col gap-2.5">
              {PROVIDER_ROLE_OPTIONS.map((role) => (
                <Radio
                  key={role}
                  name="providerRole"
                  checked={selectedRoles.has(role)}
                  onChange={() => toggleRole(role)}
                  label={roleT(role)}
                />
              ))}
            </div>
            {errors.roles ? (
              <p className="text-body-sm text-danger">{errors.roles.message}</p>
            ) : null}
            <p className="text-body-sm text-text-tertiary">
              {t("changeLaterNote")}
            </p>
            <p className="text-body-sm text-text-tertiary">
              {t("billingNotice")}
            </p>
          </div>
        </div>

        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-out",
            isModelSelected ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="flex flex-col gap-3 overflow-hidden">
            <Checkbox
              checked={watch("acceptedContentGuidelines") ?? false}
              onCheckedChange={(checked) =>
                setValue("acceptedContentGuidelines", checked)
              }
              label={
                <>
                  {t("contentGuidelinesConfirm")}
                  <Link
                    href="/guidelines"
                    target="_blank"
                    className="text-text-link hover:underline"
                  >
                    {t("contentGuidelinesLink")}
                  </Link>
                </>
              }
            />
            {errors.acceptedContentGuidelines ? (
              <p className="text-body-sm text-danger">
                {errors.acceptedContentGuidelines.message}
              </p>
            ) : null}
          </div>
        </div>

        <Input
          label={t("fullNameLabel")}
          placeholder={t("fullNamePlaceholder")}
          autoComplete="name"
          error={errors.name?.message}
          {...register("name")}
        />
        <Input
          label={t("emailLabel")}
          type="email"
          placeholder="you@studio.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <Input
          label={t("dobLabel")}
          type="date"
          error={errors.dateOfBirth?.message}
          {...register("dateOfBirth")}
        />
        <div className="flex flex-col gap-1.5">
          <Input
            label={t("passwordLabel")}
            type="password"
            placeholder={t("passwordPlaceholder")}
            autoComplete="new-password"
            error={errors.password?.message}
            {...register("password")}
          />
          <div className="flex gap-1">
            {Array.from({ length: 4 }).map((_, index) => (
              <span
                key={index}
                className={cn(
                  "h-1 flex-1 rounded-full bg-border-subtle transition-colors duration-150",
                  index < strength && strengthColor(strength),
                )}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2.5 rounded-[var(--fg-radius-md)] border border-border-subtle p-3.5">
          <Checkbox
            checked={watch("consentService") ?? false}
            onCheckedChange={(checked) =>
              setValue("consentService", checked === true)
            }
            label={
              <>
                Tôi đồng ý cho Fgrapher xử lý dữ liệu cá nhân của tôi để cung
                cấp dịch vụ (bắt buộc)
              </>
            }
          />
          {errors.consentService ? (
            <p className="text-body-sm text-danger">
              {errors.consentService.message}
            </p>
          ) : null}
          <Checkbox
            checked={watch("consentMarketing") ?? false}
            onCheckedChange={(checked) =>
              setValue("consentMarketing", checked === true)
            }
            label="Tôi đồng ý nhận thông tin khuyến mại, tin tức qua email (tùy chọn)"
          />
          <Checkbox
            checked={watch("consentAnalytics") ?? false}
            onCheckedChange={(checked) =>
              setValue("consentAnalytics", checked === true)
            }
            label="Tôi đồng ý cho Fgrapher phân tích hành vi sử dụng để cải thiện dịch vụ (tùy chọn)"
          />
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
        {t("alreadyHaveAccount")}{" "}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="font-semibold text-text-link hover:underline"
        >
          {t("signIn")}
        </button>
      </p>
    </>
  );
}
