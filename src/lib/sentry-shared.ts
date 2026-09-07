// Deliberately conservative — this app handles KYC documents, personal
// data, and session cookies under CLAUDE.md's data-protection rules, so
// the default "collect everything" behavior isn't appropriate. This
// still captures what error tracking actually needs (exception, stack
// trace, route, timestamp) without cookies/auth headers/request bodies/
// local variable values ever leaving the app. Shared by every Sentry.init
// call (client, server, edge) so the three runtimes can't drift apart.
// Not explicitly typed against @sentry/nextjs's DataCollection — that
// type isn't re-exported from the package's public entrypoint, only used
// internally — but each Sentry.init({ dataCollection: ... }) call site
// still gets full structural checking against it.
export const sentryDataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: false, response: false },
  httpBodies: [],
  urlQueryParams: false,
  stackFrameVariables: false,
};

// Pure error tracking, not full request tracing — matches what was
// actually asked for. Revisit (and budget the added event volume against
// the free tier) if performance monitoring becomes a real need later.
export const sentryTracesSampleRate = 0;
