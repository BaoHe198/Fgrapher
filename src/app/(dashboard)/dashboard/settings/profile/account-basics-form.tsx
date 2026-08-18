"use client";

import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { startTransition, useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";

export function AccountBasicsForm({
  initialUsername,
  initialBio,
}: {
  initialUsername: string | null;
  initialBio: string | null;
}) {
  const [username, setUsername] = useState(initialUsername ?? "");
  const [bio, setBio] = useState(initialBio ?? "");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">(
    "idle",
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const isUnchangedOrTooShort = username === (initialUsername ?? "") || username.length < 3;

    startTransition(() => {
      setUsernameStatus(isUnchangedOrTooShort ? "idle" : "checking");
    });
    if (isUnchangedOrTooShort) {
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/users/username-available?value=${encodeURIComponent(username)}`);
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

  const saveBio = async (value: string) => {
    await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio: value }),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-body-sm font-semibold text-text-primary">Username</label>
        <div className="flex items-center gap-2">
          <Input
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
        {usernameStatus === "taken" ? (
          <p className="text-body-sm text-danger">That username is taken</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-body-sm font-semibold text-text-primary">Bio</label>
          <span className="text-body-sm text-text-tertiary">{bio.length}/500</span>
        </div>
        <textarea
          maxLength={500}
          className="min-h-24 w-full rounded-[var(--fg-radius-md)] border border-border-default bg-bg-surface px-3.5 py-2.5 text-body-md text-text-primary outline-none focus:border-border-focus focus:ring-2 focus:ring-gold-500/20"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          onBlur={(e) => saveBio(e.target.value)}
        />
      </div>
    </div>
  );
}
