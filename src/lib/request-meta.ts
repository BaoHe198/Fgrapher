/**
 * Who sent a request, as far as the proxy headers say — for rate-limit
 * buckets and for the IP / user agent stored with consent and audit
 * records. Best-effort only: never use it to authorize anything.
 */

// x-forwarded-for is a comma-separated list when the request passed
// through multiple proxies — the first entry is the original client.
export function getRequestIp(request: Request): string | undefined {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
}

export function getRequestMeta(request: Request): {
  ipAddress: string | undefined;
  userAgent: string | undefined;
} {
  return {
    ipAddress: getRequestIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
  };
}
