// FgrapherProvider: what every Fgrapher component needs around it outside
// the app - the Vietnamese message catalog (components call next-intl's
// useTranslations), the Vietnam time zone, next-themes for light/dark, and
// the shared search-filter state the browse/shop filters read (the app
// mounts FilterParamsProvider around /browse and /shop).
import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

import { FilterParamsProvider } from "@/components/filters/filter-params-provider";

import messages from "../../src/messages/vi.json";

export interface FgrapherProviderProps {
  children?: ReactNode;
  /** "light" (default) or "dark" - the app supports both via next-themes. */
  theme?: "light" | "dark";
}

export function FgrapherProvider({ children, theme = "light" }: FgrapherProviderProps) {
  return (
    <ThemeProvider attribute="class" forcedTheme={theme} enableSystem={false}>
      <NextIntlClientProvider locale="vi" messages={messages} timeZone="Asia/Ho_Chi_Minh">
        <FilterParamsProvider>
          <div className="font-sans text-text-primary">{children}</div>
        </FilterParamsProvider>
      </NextIntlClientProvider>
    </ThemeProvider>
  );
}
