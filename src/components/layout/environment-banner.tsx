import { getTranslations } from "next-intl/server";

import { env } from "@/lib/env";

// A thin bar so it's never ambiguous which environment is on screen —
// nothing renders on production. Server Component: reads env.APP_ENV
// directly, no client-side state needed.
export async function EnvironmentBanner() {
  if (env.APP_ENV === "production") return null;

  const isStaging = env.APP_ENV === "staging";
  const t = await getTranslations("sharedComponents.environmentBanner");

  return (
    <div
      className={`w-full py-1 text-center text-xs font-semibold text-white ${
        isStaging ? "bg-orange-500" : "bg-blue-500"
      }`}
    >
      {isStaging ? t("staging") : t("development")}
    </div>
  );
}
