import { Compass } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <Compass className="size-14 text-text-tertiary" />
      <h1 className="text-display-lg text-text-primary">{t("title")}</h1>
      <p className="max-w-md text-body-md text-text-secondary">{t("body")}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button
          variant="accent"
          nativeButton={false}
          render={<Link href="/" />}
        >
          {t("home")}
        </Button>
        <Button
          variant="secondary"
          nativeButton={false}
          render={<Link href="/browse" />}
        >
          {t("browse")}
        </Button>
      </div>
    </div>
  );
}
