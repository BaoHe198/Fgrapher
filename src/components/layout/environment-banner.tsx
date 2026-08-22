import { env } from "@/lib/env";

// A thin bar so it's never ambiguous which environment is on screen —
// nothing renders on production. Server Component: reads env.APP_ENV
// directly, no client-side state needed.
export function EnvironmentBanner() {
  if (env.APP_ENV === "production") return null;

  const isStaging = env.APP_ENV === "staging";

  return (
    <div
      className={`w-full py-1 text-center text-xs font-semibold text-white ${
        isStaging ? "bg-orange-500" : "bg-blue-500"
      }`}
    >
      {isStaging ? "STAGING" : "DEVELOPMENT"}
    </div>
  );
}
