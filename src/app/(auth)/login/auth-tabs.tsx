"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { RegisterForm } from "@/app/(auth)/register/register-form";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";

import { LoginForm } from "./login-form";

type Mode = "login" | "register";

interface AuthTabsProps {
  initialRole?: string;
  interval: "month" | "year";
  callbackUrl?: string;
  hasError: boolean;
  marketplaceEnabled: boolean;
}

export function AuthTabs({
  initialRole,
  interval,
  callbackUrl,
  hasError,
  marketplaceEnabled,
}: AuthTabsProps) {
  const t = useTranslations("auth");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const mode: Mode =
    searchParams.get("mode") === "register" ? "register" : "login";

  // Switching tabs never navigates — it only rewrites the `mode` query
  // param (so it's linkable/refresh-safe) and keeps every other param
  // (role, interval, callbackUrl) intact, which is also what keeps the
  // AuthShell visual column in (auth)/layout.tsx mounted rather than
  // flashing on a real page transition.
  const setMode = (next: Mode) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "login") {
      params.delete("mode");
    } else {
      params.set("mode", "register");
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  return (
    <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
      <TabsList>
        <TabsTab value="login">{t("loginTab")}</TabsTab>
        <TabsTab value="register">{t("registerTab")}</TabsTab>
      </TabsList>

      <TabsPanel value="login" className="mt-6 flex flex-col gap-[22px]">
        <LoginForm
          callbackUrl={callbackUrl}
          hasError={hasError}
          onSwitchToRegister={() => setMode("register")}
        />
      </TabsPanel>

      <TabsPanel value="register" className="mt-6 flex flex-col gap-[22px]">
        <RegisterForm
          interval={interval}
          initialRole={initialRole}
          onSwitchToLogin={() => setMode("login")}
          marketplaceEnabled={marketplaceEnabled}
        />
      </TabsPanel>
    </Tabs>
  );
}
