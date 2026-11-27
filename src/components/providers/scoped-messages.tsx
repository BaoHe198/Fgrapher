import { getMessages } from "next-intl/server";

import { MergedMessagesProvider } from "@/components/providers/merged-messages-provider";
import {
  CLIENT_MESSAGE_SCOPES,
  type ClientMessageScope,
} from "@/i18n/client-message-scopes.generated";
import { pickMessages, type MessageTree } from "@/i18n/pick-messages";

interface ScopedMessagesProps {
  scope: ClientMessageScope;
  children: React.ReactNode;
}

/**
 * Gives the Client Components of one area of the app the translations they
 * use, and only those. Goes in the area's layout.tsx, around `children`.
 *
 * The root layout provides the few namespaces every page needs; this adds
 * the area's own. Which namespaces an area needs is worked out from the
 * source by scripts/gen-client-message-scopes.mjs — nothing here is a list
 * to keep up by hand.
 *
 * Server Components are not affected either way: useTranslations() and
 * getTranslations() on the server always read the whole catalogue.
 */
export async function ScopedMessages({ scope, children }: ScopedMessagesProps) {
  const messages = (await getMessages()) as MessageTree;

  return (
    <MergedMessagesProvider
      messages={pickMessages(messages, CLIENT_MESSAGE_SCOPES[scope])}
    >
      {children}
    </MergedMessagesProvider>
  );
}
