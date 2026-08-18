import { useSyncExternalStore } from "react";

function subscribeNoop() {
  return () => {};
}

// Avoids a hydration mismatch for anything that only knows its real value on
// the client (theme, viewport width, etc): the server always renders the
// "unmounted" branch, then this flips to true right after mount.
export function useMounted() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}
