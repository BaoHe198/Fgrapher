"use client";

import { Loader2 } from "lucide-react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A11.998 11.998 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.27A11.998 11.998 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39l4-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A11.998 11.998 0 0 0 1.27 6.61l4 3.11C6.22 6.87 8.87 4.76 12 4.76Z"
      />
    </svg>
  );
}

interface SocialRowProps {
  callbackUrl?: string;
}

function SocialRow({ callbackUrl = "/dashboard" }: SocialRowProps) {
  const t = useTranslations("uiKit.socialRow");
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const onGoogleSignIn = () => {
    setIsGoogleLoading(true);
    signIn("google", { callbackUrl });
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border-subtle" />
        <span className="text-body-sm text-text-tertiary">
          {t("orDivider")}
        </span>
        <div className="h-px flex-1 bg-border-subtle" />
      </div>

      {/* Apple sign-in used to sit here, permanently disabled with a
          "coming soon" tooltip that phones never show — a button that
          does nothing reads as broken. It comes back when it works. */}
      <div className="flex gap-2.5">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          disabled={isGoogleLoading}
          onClick={onGoogleSignIn}
        >
          {isGoogleLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <GoogleIcon className="size-4" />
          )}
          Google
        </Button>
      </div>
    </>
  );
}

export { SocialRow };
