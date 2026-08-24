"use client";

import { Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useLocale, useTranslations } from "next-intl";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { toast } from "@/components/ui/toast";
import { useMounted } from "@/hooks/use-mounted";
import { setLocale } from "@/i18n/actions";
import { routing } from "@/i18n/routing";

interface AccountSettingsFormProps {
  initialEmail: string;
  initialPhone: string | null;
}

export function AccountSettingsForm({
  initialEmail,
  initialPhone,
}: AccountSettingsFormProps) {
  const router = useRouter();
  const mounted = useMounted();
  const locale = useLocale();
  const { theme, setTheme } = useTheme();
  const [, startTransition] = useTransition();
  const t = useTranslations("dashboardSettings.account");

  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [savingBasics, setSavingBasics] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const saveBasics = async () => {
    setSavingBasics(true);
    await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, phone }),
    });
    setSavingBasics(false);
    toast.add({ title: t("toastAccountUpdated"), type: "success" });
  };

  const changePassword = async () => {
    setPasswordError(null);
    if (newPassword !== confirmPassword) {
      setPasswordError(t("passwordMismatch"));
      return;
    }

    setIsChangingPassword(true);
    const res = await fetch("/api/users/me/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
    const body = await res.json();
    setIsChangingPassword(false);

    if (!res.ok) {
      setPasswordError(body.message ?? t("genericError"));
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    toast.add({ title: t("toastPasswordUpdated"), type: "success" });
  };

  const deleteAccount = async () => {
    setIsDeleting(true);
    await fetch("/api/users/me", { method: "DELETE" });
    await signOut({ callbackUrl: "/" });
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Input
          label={t("emailLabel")}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label={t("phoneLabel")}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          disabled={savingBasics}
          onClick={saveBasics}
        >
          {savingBasics ? <Loader2 className="size-4 animate-spin" /> : null}
          {t("save")}
        </Button>
      </div>

      <div className="h-px bg-border-subtle" />

      <div className="flex flex-col gap-4">
        <span className="text-body-md font-semibold text-text-primary">
          {t("changePasswordTitle")}
        </span>
        {passwordError ? (
          <div className="rounded-[var(--fg-radius-md)] bg-danger-bg p-3 text-body-sm text-danger">
            {passwordError}
          </div>
        ) : null}
        <Input
          label={t("currentPasswordLabel")}
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <Input
          label={t("newPasswordLabel")}
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <Input
          label={t("confirmPasswordLabel")}
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          disabled={isChangingPassword || !currentPassword || !newPassword}
          onClick={changePassword}
        >
          {isChangingPassword ? (
            <Loader2 className="size-4 animate-spin" />
          ) : null}
          {t("updatePassword")}
        </Button>
      </div>

      <div className="h-px bg-border-subtle" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NativeSelect
          label={t("languageLabel")}
          value={locale}
          options={routing.locales.map((code) => ({
            value: code,
            label: code.toUpperCase(),
          }))}
          onChange={(value) =>
            startTransition(async () => {
              await setLocale(value as (typeof routing.locales)[number]);
              router.refresh();
            })
          }
        />
        <NativeSelect
          label={t("themeLabel")}
          value={mounted ? (theme ?? "system") : "system"}
          options={[
            { value: "light", label: t("themeLight") },
            { value: "dark", label: t("themeDark") },
            { value: "system", label: t("themeSystem") },
          ]}
          onChange={(value) => setTheme(value)}
        />
      </div>

      <div className="h-px bg-border-subtle" />

      <div className="flex flex-col gap-2 rounded-[var(--fg-radius-md)] border border-danger p-4">
        <span className="text-body-md font-semibold text-danger">
          {t("dangerZoneTitle")}
        </span>
        <p className="text-body-sm text-text-secondary">
          {t("dangerZoneDesc")}
        </p>
        <Button
          variant="destructive"
          size="sm"
          className="self-start"
          onClick={() => setDeleteOpen(true)}
        >
          {t("deleteAccount")}
        </Button>

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("deleteDialogTitle")}</DialogTitle>
            </DialogHeader>
            <p className="text-body-sm text-text-secondary">
              {t("deleteDialogBody")}
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
                {t("cancel")}
              </Button>
              <Button
                variant="destructive"
                disabled={isDeleting}
                onClick={deleteAccount}
              >
                {isDeleting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {t("deleteAccount")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
