"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useTransition } from "react";

import { cn } from "@/lib/utils";

interface HomeFilterValue {
  /** True while the rows for a newly picked tab are on their way. */
  pending: boolean;
  /** Switch the home page to a service tab (null = Tất cả), in place. */
  selectRole: (role: string | null) => void;
}

const HomeFilterContext = createContext<HomeFilterValue>({
  pending: false,
  selectRole: () => {},
});

export const useHomeFilter = () => useContext(HomeFilterContext);

// The service tabs filter the home page itself, as Airbnb's do (owner,
// 17/11/2026), instead of jumping to Tìm kiếm F. The choice lives in the
// URL (/?role=PHOTOGRAPHER) so it can be shared and survives a reload; the
// page re-renders its rows on the server. While that happens the current
// rows fade a little, so a tap visibly did something, and the page keeps
// its scroll position.
export function HomeFilter({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const selectRole = (role: string | null) => {
    startTransition(() => {
      router.push(role ? `/?role=${role}` : "/", { scroll: false });
    });
  };

  return (
    <HomeFilterContext.Provider value={{ pending, selectRole }}>
      {children}
    </HomeFilterContext.Provider>
  );
}

/** Wraps the rows so they fade while a new tab's rows load. */
export function HomeRows({ children }: { children: React.ReactNode }) {
  const { pending } = useHomeFilter();
  return (
    <div
      aria-busy={pending}
      className={cn(
        "transition-opacity duration-[var(--fg-dur-260)] ease-fg-out",
        pending && "opacity-50",
      )}
    >
      {children}
    </div>
  );
}
