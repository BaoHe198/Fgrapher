"use client";

import { NextIntlClientProvider, useLocale, useMessages } from "next-intl";
import { useMemo } from "react";

import { mergeMessages, type MessageTree } from "@/i18n/pick-messages";

interface MergedMessagesProviderProps {
  /** This area's cut of the catalogue (see ScopedMessages). */
  messages: MessageTree;
  children: React.ReactNode;
}

// The client half of <ScopedMessages>. A nested next-intl provider REPLACES
// the messages of the one above it, so handing it only this area's cut would
// take away what the root layout provides (the cookie notice, the chat
// popup, toasts). This adds the area's cut to whatever is already in reach
// instead. Locale, time zone and formats are inherited from the root
// provider by next-intl itself.
export function MergedMessagesProvider({
  messages,
  children,
}: MergedMessagesProviderProps) {
  const locale = useLocale();
  const inherited = useMessages() as MessageTree;
  const merged = useMemo(
    () => mergeMessages(inherited, messages),
    [inherited, messages],
  );

  return (
    <NextIntlClientProvider locale={locale} messages={merged}>
      {children}
    </NextIntlClientProvider>
  );
}
