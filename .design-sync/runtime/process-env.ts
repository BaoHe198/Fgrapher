// Next.js inlines process.env.NEXT_PUBLIC_* at build time, so client code
// reads it freely (profile-actions.tsx: the Zalo OA id). Outside Next there
// is no `process` at all and the read throws, blanking the component. An
// empty env makes every such value undefined - the same as "not configured".
// Imported first in entry.ts so it runs before any component module.
const g = globalThis as { process?: { env: Record<string, string | undefined> } };
if (typeof g.process === "undefined") g.process = { env: {} };

export {};
