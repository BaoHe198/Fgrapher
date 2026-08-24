"use client";

import { Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useLocale } from "next-intl";
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
    toast.add({ title: "Account updated", type: "success" });
  };

  const changePassword = async () => {
    setPasswordError(null);
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
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
      setPasswordError(body.message ?? "Something went wrong");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    toast.add({ title: "Password updated", type: "success" });
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
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Phone number"
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
          Save
        </Button>
      </div>

      <div className="h-px bg-border-subtle" />

      <div className="flex flex-col gap-4">
        <span className="text-body-md font-semibold text-text-primary">
          Change password
        </span>
        {passwordError ? (
          <div className="rounded-[var(--fg-radius-md)] bg-danger-bg p-3 text-body-sm text-danger">
            {passwordError}
          </div>
        ) : null}
        <Input
          label="Current password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <Input
          label="New password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <Input
          label="Confirm new password"
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
          Update password
        </Button>
      </div>

      <div className="h-px bg-border-subtle" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NativeSelect
          label="Language"
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
          label="Theme"
          value={mounted ? (theme ?? "system") : "system"}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "system", label: "System" },
          ]}
          onChange={(value) => setTheme(value)}
        />
      </div>

      <div className="h-px bg-border-subtle" />

      <div className="flex flex-col gap-2 rounded-[var(--fg-radius-md)] border border-danger p-4">
        <span className="text-body-md font-semibold text-danger">
          Danger zone
        </span>
        <p className="text-body-sm text-text-secondary">
          Deleting your account is permanent. This cannot be undone.
        </p>
        <Button
          variant="destructive"
          size="sm"
          className="self-start"
          onClick={() => setDeleteOpen(true)}
        >
          Delete account
        </Button>

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete your account?</DialogTitle>
            </DialogHeader>
            <p className="text-body-sm text-text-secondary">
              This will permanently deactivate your Fgrapher account. This
              action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={isDeleting}
                onClick={deleteAccount}
              >
                {isDeleting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Delete account
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
