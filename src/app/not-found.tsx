import { Compass } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <Compass className="size-14 text-text-tertiary" />
      <h1 className="text-display-lg text-text-primary">Page not found</h1>
      <p className="max-w-md text-body-md text-text-secondary">
        The page you&apos;re looking for doesn&apos;t exist, or may have been moved.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="accent" nativeButton={false} render={<Link href="/" />}>
          Go home
        </Button>
        <Button variant="secondary" nativeButton={false} render={<Link href="/browse" />}>
          Browse artists
        </Button>
      </div>
    </div>
  );
}
