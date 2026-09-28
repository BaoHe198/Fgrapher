# Claude Design sync — notes

Fgrapher is a Next.js **app**, not a published component package. The sync
treats it as the package shape with a hand-written entry. Read this before any
re-sync.

## How the build is wired

- **Entry**: `.design-sync/entry.ts` re-exports the components that can render
  in a plain browser, plus `FgrapherProvider`. Pass it with
  `--entry .design-sync/entry.ts`. Adding a component = one `export *` line
  here + one `componentSrcMap` entry in `config.json`.
- **Next.js shims** (`.design-sync/runtime/`), wired through
  `.design-sync/tsconfig.ds.json` `paths` (the converter's tsconfig-paths
  plugin resolves them): `next/link` → plain `<a>`, `next/image` → `<img>`,
  `next/navigation` → no-op router / `/` pathname / empty search params,
  `next-auth/react` → signed-out session, `@/lib/features` → production flag
  values (the real module parses server env vars and throws in a browser).
- **Directory imports** (`@/lib/constants`, `@/lib/email`,
  `@/lib/notifications`) need an explicit `paths` entry to their `index.ts`:
  the converter's paths plugin returns the bare directory otherwise
  ("Cannot read file ... is a directory"). A new `lib/<dir>/index.ts` that
  components import needs the same entry.
- **Provider**: `cfg.provider = FgrapherProvider` (`runtime/provider.tsx`):
  NextIntlClientProvider with `src/messages/vi.json`, locale `vi`, time zone
  `Asia/Ho_Chi_Minh`, next-themes (`theme="light" | "dark"`), and
  `FilterParamsProvider` (SearchInput/FilterSidebar/ShopFilters throw without
  it; it only touches the navigation shim).
- **`process.env`**: Next inlines `NEXT_PUBLIC_*` at build time; outside Next
  there is no `process`. `runtime/process-env.ts` (imported first in
  `entry.ts`) installs an empty `process.env`, so such reads are undefined
  ("not configured"). Without it ProfileActions renders blank - and the
  capture log does NOT flag it (0 errors; only a `pageerror` in the browser).
- `next/script` is shimmed to render nothing (the Zalo widget).
- **CSS**: `buildCmd` = `node .design-sync/build-css.mjs` → compiles
  `src/app/globals.css` with Tailwind v4 into `.design-sync/.cache/fgrapher.css`
  (`cfg.cssEntry`). It safelists layout/spacing families and every
  `--color-*` token and `@utility` from globals.css so the design agent's own
  layouts have classes to use, and scans `.design-sync/previews`. Fonts come
  from a Google Fonts `@import` ([FONT_REMOTE] is expected): next/font only
  exists inside Next.
- **Guidelines**: `guidelinesGlob` is limited to `docs/design-reference/*.md`.
  The default would upload internal planning/ops docs (prompts, environment
  and database notes) into the design project.

## Re-sync (one command after setup)

Claude Design project: https://claude.ai/design/p/f198f9b9-9990-46a8-a6c1-be976a006baa
(`projectId` in config.json). From the repo root:

```sh
SK=<design-sync skill dir>
mkdir -p .ds-sync && cp -r "$SK"/package-build.mjs "$SK"/package-validate.mjs \
  "$SK"/package-capture.mjs "$SK"/resync.mjs "$SK"/lib "$SK"/storybook .ds-sync/
echo '{"name":"ds-sync-deps","private":true}' > .ds-sync/package.json
(cd .ds-sync && npm i esbuild ts-morph @types/react playwright@<repo's @playwright/test version>)
node .design-sync/build-css.mjs          # cfg.buildCmd - always before a build
# fetch the project's _ds_sync.json to .design-sync/.cache/remote-sync.json, then:
node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules ./node_modules \
  --entry .design-sync/entry.ts --out ./ds-bundle --remote .design-sync/.cache/remote-sync.json
```

Playwright must match the cached chromium build (the repo's own
`@playwright/test` pins it; 1.62.1 ↔ chromium-1234 on 28/09/2026).
`.design-sync/` is in `.prettierignore` on purpose: reformatting a preview
changes its source hash and forces a re-verify.

## Left out on purpose (cannot render outside the Next.js server)

- Async server components: `ModelSafetyNotice`, `ProductCard` (both call
  next-intl's `getTranslations`). ProductCard is worth converting to a client
  component later so Chợ F designs can use it.
- Read the database / server services: `PastDueBanner`, `ReviewReminderBanner`,
  `SubscriptionGate`, `BookingSidebar`, `FmapProviderPreviewCard`.
- Map + live data: `FmapMap`.
- Session/API-bound shells: `WebNav`, `DashboardSidebar`,
  `MobileDashboardSidebar`, `NotificationBell`, `MessagingPopup`, `ChatPanel`,
  `CartDrawer`.
- Invisible/providers: `AuthProvider`, `MessagingProvider`, `ThemeProvider`,
  `FilterParamsProvider`, `FilterResultsPane`, `ProfileViewBeacon`,
  `EnvironmentBanner`, `CookieSettingsLink`.

## Authoring previews (`.design-sync/previews/<Name>.tsx`)

- Import from `"fgrapher"` (the package name). The provider wraps every cell
  automatically - do not add `FgrapherProvider` yourself.
- **All copy in Vietnamese**, realistic Fgrapher content (photographers,
  studios, makeup artists, models, costume shops, Chợ F gear). Money as
  `1.500.000₫`, dates `dd/MM/yyyy`, places as real HCMC wards
  ("Phường Thủ Đức, Thành phố Hồ Chí Minh").
- **No remote images**: captures run offline. Use inline SVG data-URI
  gradients in brand colours (see `previews/ArtistCard.tsx`'s `photo()`).
- Overlays render open (`open` prop) and already have `cardMode: single` in
  config; wide components have `cardMode: column`.
- Components that fetch on submit/mount still render statically - fetches
  fail quietly; do not rely on fetched data appearing (FilterSidebar and
  FmapFilterBar province selects show only the placeholder).
- **Tailwind classes new to a preview need a full build.**
  `preview-rebuild.mjs` does not rerun `build-css.mjs`, so an arbitrary class
  that first appears in a preview (`w-[420px]`, `h-[360px]`) has no rule until
  the next `package-build.mjs` and silently does nothing. Prefer classes the
  app already uses (`max-w-xs`...`max-w-2xl`, `w-64`, `w-[300px]`,
  `w-[340px]`), or run a full build before trusting the capture.
- Default card viewport is 900x700 and not full-page: `lg:`-gated layouts
  (HeroContactSheet is `max-lg:hidden`) and tall forms need a `viewport`
  override (set in config).
- A `position: fixed`, non-portalled component (CookieConsentBanner) inside a
  single card needs an in-flow wrapper with height - the card root has a
  transform, so it becomes the containing block.
- Sheet: pass `initialFocus={false}` to `SheetContent`, or the capture shows
  a focus ring. Toaster: add toasts from a child via
  `useToastManager().add({..., timeout: 0})` once (ref-guarded).
- Auto-focus rings: Base UI focuses the first focusable when a dialog opens.
  `DialogContent`/`SheetContent` take `initialFocus={false}`; for components
  that don't forward it (QrCodeDialog, ReviewModal) the preview blurs
  `document.activeElement` shortly after mount. AvailabilityDialog doesn't
  forward it either (its first link shows a ring - accepted).
- Entrance animations: HeroContactSheet frames use `animate-develop` (900ms
  fade from 0), so captures land mid-fade. Previews showing it add a scoped
  `<style>[data-hero-still] img{animation:none!important}</style>`.
- Native `<input type="time">` shows "09:00 AM" in the capture browser; a
  Vietnamese browser shows 24h.
- Check a class exists with `grep -cF 'w-\[640px\]' ds-bundle/_ds_bundle.css`
  (fixed-string; a regex-escaped pattern falsely returns 0).
- FilterSidebar cells share filter state through FilterParamsProvider, so one
  cell can show defaults checked and another not - cosmetic.
- Capture pins the clock at 2024-05-15; build relative timestamps from
  `Date.now()` so "5 phút trước"-style labels stay sensible.
- Budget 2-6 named exports per component.

## Component quirks found while authoring

- `Textarea` is still shadcn-default styled (`border-input`, `ring-ring`) and
  has no `label`/`error` props, unlike Input/NativeSelect/CurrencyInput; its
  preview composes label + helper around it. `field-sizing-content` ignores
  `rows` (renders ~2 lines). Candidate for the brand-token pass.
- `Card` pads itself and CardHeader/CardContent/CardFooter add the same
  horizontal padding again (double indent; CardFooter's band sits inset). The
  app never uses those sub-parts: it uses `<Card className="flex flex-col
  gap-N">` with direct children, or `padding={false}` for flush media.
- `MobileFilterSheet` has no `open` prop, so only its trigger renders in a
  preview. `ImageCropDialog`'s zoom slider is an unstyled native range input.
  `Skeleton` (`bg-muted`) is very pale on white; `Progress` fills with
  `bg-primary` (near-black), not brand green - both as in the app.
- Review sheets render at ~1.75x pixel ratio: a `w-[360px]` cell measures
  ~630px on the sheet. Not missing CSS.

## Known render warns

- `[RENDER_ERRORS]` "Failed to execute 'json' on 'Response'" on FilterSidebar,
  HeroSearch, AvailabilityDialog: they fetch `/api/...` on mount, which has no
  server here or in Claude Design. The components still render.
- `[RENDER_THIN]` "rendered height is 0px" on portalled overlays in the grid
  check (Dialog, Sheet, Toaster, PhoneVerifyDialog, ReportModal,
  UploadMediaModal, ImageCropDialog, QrCodeDialog): their cards are
  `cardMode: single` and render correctly there.
- `[TOKENS_MISSING]` for `--toast-*`, `--accordion-panel-height`, `--tw`:
  Base UI sets these at runtime; not missing tokens.

## Re-sync risks

- `runtime/features.ts` hard-codes production flags (28/09/2026). If a flag
  flips in production, update it or designs show the wrong feature set.
- The shims only cover what components used on 28/09/2026 (`next/link`,
  `next/image`, `next/navigation`, `next-auth/react`). A component that starts
  importing another Next module (`next/dynamic`, `next/headers`...) breaks the
  bundle or its preview - add a shim or leave it out of `entry.ts`.
- Fonts load from Google Fonts at render time (network-dependent).
- `src/messages/vi.json` is bundled whole into `_ds_bundle.js`; it grows the
  bundle as the catalog grows.
