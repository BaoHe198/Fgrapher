"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <AlertTriangle className="size-12 text-danger" />
      <h1 className="text-heading-xl text-text-primary">Something went wrong</h1>
      <p className="max-w-md text-body-md text-text-secondary">
        This page hit an unexpected error. Try again, or head back to your dashboard.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="accent" onClick={reset}>
          Try again
        </Button>
        <Button variant="secondary" nativeButton={false} render={<Link href="/dashboard" />}>
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
