"use client";

import { CheckCircle, Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, message }),
    });

    setIsSubmitting(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.message ?? "Something went wrong. Please try again.");
      return;
    }

    setIsSent(true);
  };

  if (isSent) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle className="size-10 text-brand-primary" />
        <p className="text-body-lg font-semibold text-text-primary">Message sent</p>
        <p className="text-body-md text-text-secondary">We&apos;ll get back to you soon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
      {error ? (
        <div className="rounded-[var(--fg-radius-md)] bg-danger-bg p-3 text-body-sm text-danger">
          {error}
        </div>
      ) : null}
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <div className="flex flex-col gap-1.5">
        <label className="text-body-sm font-semibold text-text-primary">Message</label>
        <textarea
          required
          minLength={10}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="min-h-32 w-full rounded-[var(--fg-radius-md)] border border-border-default bg-bg-surface px-3.5 py-2.5 text-body-md text-text-primary outline-none focus:border-border-focus focus:ring-2 focus:ring-gold-500/20"
        />
      </div>
      <Button type="submit" variant="accent" size="lg" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
        Send message
      </Button>
    </form>
  );
}
