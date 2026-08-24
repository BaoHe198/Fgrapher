"use client";

import type { Role } from "@prisma/client";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Prompt B4, VIỆC 4 — shown in /browse's empty state when a province+role
// search comes up empty/thin, offering a "notify me" capture instead of a
// dead end. Only rendered when exactly one role is active in the filters
// (see browse/page.tsx) — a WaitlistEntry needs a single role, and
// guessing which of several selected roles the visitor cares about would
// be wrong.
export function WaitlistForm({
  provinceId,
  role,
}: {
  provinceId: string;
  role: Role;
}) {
  const t = useTranslations("publicPages.browse.waitlist");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    setStatus("submitting");
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, provinceId, role }),
    });
    const body = await res.json();
    setMessage(body.message ?? null);
    setStatus(res.ok ? "done" : "idle");
  };

  if (status === "done") {
    return <p className="text-body-sm text-success">{message}</p>;
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <p className="text-body-sm text-text-secondary">{t("prompt")}</p>
      <div className="flex gap-2">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailPlaceholder")}
          className="flex-1"
        />
        <Button
          variant="secondary"
          size="sm"
          disabled={status === "submitting" || !email}
          onClick={submit}
        >
          {t("submit")}
        </Button>
      </div>
      {message && status === "idle" ? (
        <p className="text-body-sm text-danger">{message}</p>
      ) : null}
    </div>
  );
}
