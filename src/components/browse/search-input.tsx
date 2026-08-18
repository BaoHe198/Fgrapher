"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";

export function SearchInput({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    startTransition(() => {
      setValue(searchParams.get("q") ?? "");
    });
  }, [searchParams]);

  const pushQuery = (q: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (q) next.set("q", q);
    else next.delete("q");
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  };

  const onChange = (next: string) => {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushQuery(next), 300);
  };

  const onClear = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setValue("");
    pushQuery("");
  };

  return (
    <div className={`relative ${className ?? ""}`}>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-text-tertiary" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search artists, studios or gear"
        className="h-11 w-full rounded-full border border-border-default bg-bg-surface py-2 pr-10 pl-10 text-body-md text-text-primary outline-none focus:border-border-focus focus:ring-2 focus:ring-gold-500/20"
      />
      {value ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute top-1/2 right-3.5 -translate-y-1/2 text-text-tertiary"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
