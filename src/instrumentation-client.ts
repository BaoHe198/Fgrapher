import { startErrorReporting } from "@/lib/sentry-client";

// Next.js file convention (src/instrumentation-client.ts, v15.3+) — runs
// in the browser before hydration.
//
// It used to import the Sentry SDK and call Sentry.init() right here, which
// put the whole SDK in every page's first download. Error reporting now
// starts from lib/sentry-client.ts once the page is idle; see that file for
// what is kept in the meantime and for the init options (unchanged).
startErrorReporting();
