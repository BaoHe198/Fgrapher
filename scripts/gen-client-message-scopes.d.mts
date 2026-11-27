/** Area name → the folder whose layout.tsx wraps it in <ScopedMessages>. */
export const SCOPE_DIRS: Record<string, string>;

/**
 * Which translation namespaces each area's Client Components ask for.
 * `problems` lists useTranslations() calls in client code whose namespace
 * could not be read from the source (none, or a computed one).
 */
export function computeClientMessageScopes(rootDir: string): {
  scopes: Record<string, string[]>;
  problems: string[];
};
