// Design-sync shim for next/navigation: no router outside the app, so
// navigation is a no-op and the URL reads as the site root.
const router = {
  push: () => {},
  replace: () => {},
  refresh: () => {},
  back: () => {},
  forward: () => {},
  prefetch: () => {},
};

export function useRouter() {
  return router;
}
export function usePathname() {
  return "/";
}
export function useSearchParams() {
  return new URLSearchParams() as unknown as URLSearchParams & {
    get(name: string): string | null;
  };
}
export function useParams() {
  return {};
}
export function notFound(): never {
  throw new Error("notFound() called in a design preview");
}
export function redirect(): never {
  throw new Error("redirect() called in a design preview");
}
