"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  getCompleteProfileSchema,
  type CompleteProfileInput,
} from "@/lib/validations/auth";

export function CompleteProfileForm() {
  const router = useRouter();
  const tValidation = useTranslations("libServices.validation.auth");
  const completeProfileSchema = useMemo(
    () => getCompleteProfileSchema(tValidation),
    [tValidation],
  );
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CompleteProfileInput>({
    resolver: zodResolver(completeProfileSchema),
    defaultValues: {
      dateOfBirth: "",
      // Never pre-ticked — each is its own separate, explicit choice, same
      // as the registration form.
      consentService: false,
      consentMarketing: false,
      consentAnalytics: false,
    },
  });

  const onSubmit = async (values: CompleteProfileInput) => {
    setServerError(null);
    const res = await fetch("/api/onboarding/complete-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const body = await res.json();

    if (!res.ok) {
      setServerError(body.message ?? "Đã xảy ra lỗi. Vui lòng thử lại.");
      return;
    }

    // Straight to the profile settings page rather than the dashboard —
    // Google OAuth only hands over name/email, so avatar/cover/bio/phone
    // are still missing at this point. Continuing the same momentum as a
    // manual registration (which collects everything upfront) beats
    // landing on the dashboard and hoping they notice the "complete your
    // profile" reminder card there on their own.
    router.push("/dashboard/settings/profile");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {serverError ? (
        <div className="rounded-[var(--fg-radius-md)] bg-danger-bg p-3 text-body-sm text-danger">
          {serverError}
        </div>
      ) : null}

      <Input
        label="Ngày sinh"
        type="date"
        error={errors.dateOfBirth?.message}
        {...register("dateOfBirth")}
      />

      <div className="flex flex-col gap-2.5 rounded-[var(--fg-radius-md)] border border-border-subtle p-3.5">
        <Checkbox
          checked={watch("consentService") ?? false}
          onCheckedChange={(checked) =>
            setValue("consentService", checked === true)
          }
          label={
            <>
              Tôi đồng ý cho Fgrapher xử lý dữ liệu cá nhân của tôi để cung cấp
              dịch vụ (bắt buộc)
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

      <Button type="submit" variant="accent" size="lg" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
        Tiếp tục
      </Button>
    </form>
  );
}
