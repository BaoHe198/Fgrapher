import * as Sentry from "@sentry/nextjs";

// Next.js file convention (src/instrumentation.ts) — register() runs once
// per server instance before it handles any request; onRequestError fires
// for uncaught errors in Server Components, Route Handlers, Server
// Actions, and proxy.ts. See node_modules/next/dist/docs/01-app/03-api-
// reference/03-file-conventions/instrumentation.md — this fork's version
// history matches stock Next.js 15+ here, just with routeType including
// "proxy" instead of "middleware".
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
