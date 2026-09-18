"use client";

import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { startTransition, useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { provincesApiPath, wardsApiPath } from "@/lib/geography-client";

interface WardOption {
  id: string;
  name: string;
}

interface ProvinceOption {
  id: string;
  code: string;
  name: string;
}

export function AccountBasicsForm({
  initialName,
  initialUsername,
  initialWardId,
  initialProvinceId,
  showDisplayName,
}: {
  initialName: string | null;
  initialUsername: string | null;
  initialWardId: string | null;
  initialProvinceId: string | null;
  showDisplayName: boolean;
}) {
  const t = useTranslations("dashboardSettings.profile.basics");
  const [name, setName] = useState(initialName ?? "");
  const [username, setUsername] = useState(initialUsername ?? "");
  const [wardId, setWardId] = useState(initialWardId ?? "");
  const [provinceId, setProvinceId] = useState(initialProvinceId ?? "");
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [wards, setWards] = useState<WardOption[]>([]);

  useEffect(() => {
    fetch(provincesApiPath())
      .then((res) => res.json())
      .then((body) => startTransition(() => setProvinces(body.data ?? [])));
  }, []);

  const provinceCode = provinces.find(
    (province) => province.id === provinceId,
  )?.code;

  useEffect(() => {
    const controller = new AbortController();
    if (!provinceCode) {
      startTransition(() => setWards([]));
      return () => controller.abort();
    }
    fetch(wardsApiPath(provinceCode), { signal: controller.signal })
      .then((res) => res.json())
      .then((body) => startTransition(() => setWards(body.data ?? [])))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          startTransition(() => setWards([]));
        }
      });
    return () => controller.abort();
  }, [provinceCode]);

  const saveWard = async (value: string) => {
    startTransition(() => setWardId(value));
    await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wardId: value || null }),
    });
  };
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const isUnchangedOrTooShort =
      username === (initialUsername ?? "") || username.length < 3;

    startTransition(() => {
      setUsernameStatus(isUnchangedOrTooShort ? "idle" : "checking");
    });
    if (isUnchangedOrTooShort) {
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(
        `/api/users/username-available?value=${encodeURIComponent(username)}`,
      );
      const body = await res.json();
      startTransition(() => {
        setUsernameStatus(body.data?.available ? "available" : "taken");
      });
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username, initialUsername]);

  const saveUsername = async () => {
    if (usernameStatus !== "available") return;
    await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
  };

  const saveName = async (value: string) => {
    if (value.trim().length < 2 || value === (initialName ?? "")) return;
    await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: value.trim() }),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {showDisplayName ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-body-sm font-semibold! text-text-primary">
            {t("displayNameLabel")}
          </label>
          <Input
            aria-label={t("displayNameLabel")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={(e) => saveName(e.target.value)}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label className="text-body-sm font-semibold! text-text-primary">
          {t("usernameLabel")}
        </label>
        <div className="flex items-center gap-2">
          <Input
            aria-label={t("usernameLabel")}
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            onBlur={saveUsername}
            className="flex-1"
          />
          {usernameStatus === "checking" ? (
            <Loader2 className="size-4 animate-spin text-text-tertiary" />
          ) : usernameStatus === "available" ? (
            <CheckCircle className="size-4 text-success" />
          ) : usernameStatus === "taken" ? (
            <XCircle className="size-4 text-danger" />
          ) : null}
        </div>
        <p className="text-body-sm text-text-tertiary">{t("usernameHint")}</p>
        {usernameStatus === "taken" ? (
          <p className="text-body-sm text-danger">{t("usernameTaken")}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NativeSelect
          label={t("provinceLabel")}
          value={provinceId}
          onChange={(value) => {
            setProvinceId(value);
            void saveWard("");
          }}
          options={[
            { value: "", label: t("provinceNotSelected") },
            ...provinces.map((province) => ({
              value: province.id,
              label: province.name,
            })),
          ]}
        />
        <NativeSelect
          label={t("wardLabel")}
          value={wardId}
          onChange={saveWard}
          disabled={!provinceId}
          options={[
            {
              value: "",
              label: provinceId
                ? t("wardNotSelected")
                : t("wardHelperNoProvince"),
            },
            ...wards.map((ward) => ({ value: ward.id, label: ward.name })),
          ]}
        />
      </div>
    </div>
  );
}
