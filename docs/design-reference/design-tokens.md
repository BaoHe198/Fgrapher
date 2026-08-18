# Fgrapher design tokens

Extracted from `Fgrapher Web UI Kit.html` (a self-extracting Claude design export — the
actual screen only renders after its bundler JS runs in a browser, so these values were
pulled via a headless-Chrome pass rather than read directly off the file). That export
contains **one screen**: the public marketing landing page. There is no dashboard, auth,
or other screen in the kit — the tokens and component patterns below are what should
generalize to everything else per-project.

Source of truth for exact values: re-open the HTML file in a browser if these ever need
re-verifying: `docs/design-reference/Fgrapher Web UI Kit.html`.

## Status

Tokens below are wired into `src/app/globals.css` / `src/app/layout.tsx` as of phase-1
Step 1 (see Implementation section at the bottom for the exact mapping and naming
decisions). shadcn's own component primitives (`src/components/ui/*`) still use
shadcn's generic default theme (`neutral` base color, `base-nova` style) — they have not
been rebuilt against the brand tokens yet; that is phase-1 Step 4.

## Brand identity

Dark forest green + warm gold, on a cream/off-white base. Two display/body fonts, one
mono. Pill-shaped buttons and badges, 12–16px card radii, soft warm-toned shadows
(never pure black).

## Color tokens

### Scales

| Step | Green (`--green-*`) | Gold (`--gold-*`) |
| ---- | ------------------- | ----------------- |
| 50   | `hsl(168 40% 96%)`  | `hsl(38 55% 96%)` |
| 100  | `hsl(168 40% 90%)`  | `hsl(38 55% 90%)` |
| 200  | `hsl(168 38% 80%)`  | `hsl(38 50% 80%)` |
| 300  | `hsl(168 36% 66%)`  | `hsl(38 48% 70%)` |
| 400  | `hsl(168 38% 50%)`  | `hsl(38 46% 60%)` |
| 500  | `hsl(168 45% 36%)`  | `hsl(38 44% 52%)` |
| 600  | `hsl(168 50% 26%)`  | `hsl(38 46% 44%)` |
| 700  | `hsl(168 55% 20%)`  | `hsl(38 48% 36%)` |
| 800  | `hsl(168 58% 15%)`  | `hsl(38 50% 28%)` |
| 900  | `hsl(168 60% 11%)`  | `hsl(38 52% 20%)` |
| 950  | `hsl(168 62% 7%)`   | —                 |

`--neutral-*` is a warm gray scale (hue 30, low saturation), 0/50…950, used for text and
surfaces rather than pure black/white. `--neutral-0` is `#ffffff`.

### Semantic tokens — light mode (default) vs dark mode

| Token              | Light                                                   | Dark                                        |
| ------------------ | ------------------------------------------------------- | ------------------------------------------- |
| `--bg-page`        | `hsl(30 20% 98%)` (warm cream)                          | `hsl(30 10% 7%)`                            |
| `--bg-surface`     | `#ffffff`                                               | `hsl(30 9% 11%)`                            |
| `--bg-sunken`      | `hsl(30 15% 95%)`                                       | `hsl(30 9% 9%)`                             |
| `--bg-inverse`     | `hsl(168 60% 11%)` (dark green — hero/CTA/footer bands) | `hsl(168 62% 7%)`                           |
| `--surface-card`   | `#ffffff`                                               | `hsl(30 9% 12%)`                            |
| `--text-primary`   | `hsl(30 15% 11%)`                                       | `hsl(30 15% 95%)`                           |
| `--text-secondary` | `hsl(30 8% 38%)`                                        | `hsl(30 8% 70%)`                            |
| `--text-tertiary`  | `hsl(30 7% 52%)`                                        | `hsl(30 7% 55%)`                            |
| `--text-on-brand`  | `#ffffff`                                               | `hsl(168 62% 7%)`                           |
| `--text-link`      | `hsl(168 55% 20%)` (dark green, not gold!)              | `hsl(38 48% 70%)` (light gold)              |
| `--border-subtle`  | `hsl(30 12% 90%)`                                       | `hsl(30 6% 20%)`                            |
| `--border-default` | `hsl(30 10% 82%)`                                       | `hsl(30 6% 27%)`                            |
| `--border-strong`  | `hsl(30 8% 68%)`                                        | `hsl(30 6% 36%)`                            |
| `--border-focus`   | `hsl(38 44% 52%)` (~gold-500)                           | `hsl(38 46% 60%)` (gold-400)                |
| `--brand-primary`  | `hsl(168 58% 15%)` (dark green)                         | `hsl(168 38% 50%)` (brighter, for contrast) |
| `--brand-accent`   | `hsl(38 46% 60%)` (gold — stable across themes)         | same                                        |

`--text-on-brand` and `--text-link` are **not** simple `var(--green-950)` /
`var(--gold-300)` references — an earlier pass through this doc assumed that from an
incomplete check; corrected above from real per-theme computed values.

Status colors **do differ by theme** (an earlier pass through this doc called them
theme-invariant — that first extraction ran under headless Chrome's default
`prefers-color-scheme: dark`, so only the dark half was ever actually captured):

| Token             | Light                                   | Dark                                    |
| ----------------- | --------------------------------------- | --------------------------------------- |
| `--success`/`-bg` | `hsl(168 50% 26%)` / `hsl(168 40% 96%)` | `hsl(168 36% 66%)` / `hsl(168 40% 14%)` |
| `--warning`/`-bg` | `hsl(35 90% 48%)` / `hsl(35 90% 96%)`   | `hsl(35 85% 62%)` / `hsl(35 60% 14%)`   |
| `--danger`/`-bg`  | `hsl(6 70% 46%)` / `hsl(6 70% 96%)`     | `hsl(6 75% 64%)` / `hsl(6 50% 15%)`     |
| `--info`/`-bg`    | `hsl(205 65% 45%)` / `hsl(205 65% 96%)` | `hsl(205 70% 65%)` / `hsl(205 50% 15%)` |

Theme switching is a plain JS toggle in the kit (no `.dark` class / `data-theme` attribute
was detectable on `<html>`/`<body>` — it re-renders inline). Wired into the app via the
project's existing `.dark` class strategy (see Implementation below), not the kit's own
mechanism.

## Typography

```
--font-display: 'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif
--font-body:    'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif
--font-mono:    'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace
```

Type scale (`font-weight/size/line-height/family`):

| Token                  | Value                                                                             |
| ---------------------- | --------------------------------------------------------------------------------- |
| `--text-display-2xl`   | `600 4rem/1.05 var(--font-display)`                                               |
| `--text-display-xl`    | `600 3rem/1.08 var(--font-display)`                                               |
| `--text-display-lg`    | `600 2.25rem/1.12 var(--font-display)`                                            |
| `--text-display-md`    | `600 1.75rem/1.2 var(--font-display)`                                             |
| `--text-heading-lg`    | `600 1.5rem/1.3 var(--font-display)`                                              |
| `--text-heading-md`    | `600 1.25rem/1.35 var(--font-body)`                                               |
| `--text-heading-sm`    | `600 1.0625rem/1.4 var(--font-body)`                                              |
| `--text-body-lg`       | `400 1.0625rem/1.55 var(--font-body)`                                             |
| `--text-body-md`       | `400 0.9375rem/1.55 var(--font-body)`                                             |
| `--text-body-sm`       | `400 0.8125rem/1.5 var(--font-body)`                                              |
| `--text-caption`       | `500 0.75rem/1.4 var(--font-body)`                                                |
| `--text-caption-upper` | `600 0.6875rem/1.3 var(--font-body)` (eyebrow labels, uppercase + letter-spacing) |

Weights used: 400 (body), 600 (nearly everything else — headings, buttons, badges, nav).
700 appears rarely.

## Spacing scale

`--space-1` through `--space-14`: `2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128`
(px). Roughly a 4px base grid that widens at the top end. Doesn't map 1:1 to Tailwind's
default scale — worth deciding whether to adopt this scale via `theme.extend.spacing` or
stick with Tailwind defaults (current `CLAUDE.md` convention) when this gets applied.

## Radii & shadows

```
--radius-none: 0px    --radius-sm: 8px     --radius-md: 12px
--radius-lg: 16px      --radius-xl: 20px    --radius-pill: 999px
```

Radii are theme-invariant. **Shadows are not** — an earlier pass through this doc called
them fixed/warm-tinted only; re-verified per theme:

| Token            | Light                                          | Dark                           |
| ---------------- | ---------------------------------------------- | ------------------------------ |
| `--shadow-sm`    | `0 1px 2px rgba(18,16,10,0.06)`                | `0 1px 2px rgba(0,0,0,0.4)`    |
| `--shadow-md`    | `0 4px 14px rgba(18,16,10,0.08)`               | `0 4px 14px rgba(0,0,0,0.45)`  |
| `--shadow-lg`    | `0 14px 36px rgba(18,16,10,0.14)`              | `0 14px 36px rgba(0,0,0,0.55)` |
| `--shadow-focus` | `0 0 0 3px hsl(38 44% 52% / 0.35)` (gold ring) | same                           |

Light shadows are warm-tinted (`rgba(18,16,10,…)`), dark shadows are neutral black —
makes sense, a warm-brown shadow would be nearly invisible against an already-dark
warm-brown background. Buttons/inputs use `--radius-md` (12px), pills/badges/avatars use
`--radius-pill`, small controls (icon buttons, nav toggle) use `--radius-sm` (8px).

## Component patterns

**Header/nav** — white bg, logo mark (two overlapping rounded-square outlines, green +
gold) + "Fgrapher" wordmark (bold), plain-text nav links, right-aligned cluster of icon
buttons (message, cart) at `--radius-sm`, a two-segment pill toggle for language
(EN/VI, active segment filled dark green), "Sign in" as plain text, "Dashboard" as an
outlined pill button, and a circular avatar with initials on a dark-green fill.

**Hero** — full-bleed `--bg-inverse` (dark green) band. Small uppercase gold eyebrow
label (`--text-caption-upper`), large white `--text-display-xl`-ish heading, muted
light-green/cream subtext. Search bar: white pill-ish input group (search icon + text
field + location field + filled gold "Search" button, `--radius-md`). Below it, a row of
role-filter pills (`--radius-pill`) — selected state is filled dark green/white text,
unselected is white/outline. Right side of hero: a 2×2 asymmetric grid of solid-color
rounded blocks as image placeholders (teal/gray/gold/mint) — i.e. the kit has no real
photography, just color-blocked placeholders standing in for portfolio images.

**Cards (profile/listing)** — used identically for "Featured near you" and "Studios for
rent": colored placeholder image block on top (rounded top corners), then name +
star-rating on one line, a role badge + location on the next, and a "From $X/unit" price
line last. **Role badges are NOT color-coded per role** — all roles share one style: gold
tint bg (`hsl` ≈ `--gold-100`/`rgb(244,233,215)`), dark gold-brown text
(`rgb(107,81,36)`), `--radius-pill`, `padding: 3px 10px`, `12px/600`.

**3-up icon feature row** ("Discover / Book / Rent or buy") — small square icon tile
(light mint bg, teal icon) + heading (`--text-heading-md`) + body text, no card
border/shadow, just three columns.

**CTA banner** — same `--bg-inverse` dark-green treatment as the hero, white heading +
subtext, single filled-gold pill button (`--radius-md`, larger padding than the nav
buttons — `13px 22px` vs `6px 12px`).

**Footer** — dark green/near-black, logo + tagline on the left, three link columns with
uppercase caption-style section labels (DISCOVER / PROVIDERS / COMPANY).

**Buttons observed:**

| Variant                | bg                                  | text                                     | radius | padding             | example                   |
| ---------------------- | ----------------------------------- | ---------------------------------------- | ------ | ------------------- | ------------------------- |
| Primary (gold, filled) | `rgb(200,166,106)` (`--gold-400`)   | `rgb(7,29,24)` (near `--green-950`)      | 12px   | `10-13px / 16-22px` | Search, Become a provider |
| Secondary (outline)    | white/transparent                   | `rgb(32,28,24)`                          | 8px    | `6px 12px`          | Dashboard                 |
| Ghost/text             | transparent                         | `rgb(32,28,24)` or brand green for links | —      | minimal             | Sign in, "See all →"      |
| Filter pill (active)   | `rgb(16,60,52)` (`--green-800`-ish) | white                                    | 999px  | `6px 14px`          | selected role filter      |
| Filter pill (inactive) | white                               | `rgb(32,28,24)`                          | 999px  | `6px 14px`          | unselected role filter    |

## Fonts to source

`Bricolage Grotesque`, `Plus Jakarta Sans`, `IBM Plex Mono` — all available on Google
Fonts.

## Implementation (phase-1 Step 1 — done)

All tokens above are wired into `src/app/globals.css` and `src/app/layout.tsx`. Fonts
are loaded via `next/font/google` (replacing Geist, which was never actually being
applied to `body` — a pre-existing bug: `--font-sans` was mapped to `var(--font-sans)`,
a circular reference resolving to nothing, so text was silently rendering in the
browser's serif fallback the whole time. Fixed as part of this).

Naming decisions, so future work matches:

- Scales (`--green-*`, `--gold-*`, `--neutral-*`) are registered under their own name in
  `@theme inline`, e.g. `bg-green-500` — this **intentionally overrides** Tailwind's
  built-in `green`/`neutral` palettes. Confirmed low blast radius: only
  `to-neutral-900` in the login/register hero gradients used a default-palette shade
  before this, and the brand's warm `neutral-900` is a similar enough dark tone that it
  reads as an improvement, not a regression.
- Semantic tokens (`--bg-surface`, `--text-primary`, `--border-subtle`, etc.) keep their
  full compound name, so the utility is the CSS prefix plus the token name verbatim —
  `bg-bg-surface`, `text-text-primary`, `border-border-subtle`. This avoids colliding
  with shadcn's own `primary`/`secondary`/`card`/`border` tokens, which the guide's
  later-step prompts do not appear to have accounted for (they casually write
  `text-primary`/`bg-surface` as if from a from-scratch Tailwind setup with no
  pre-existing shadcn theme) — translate those mentions to the compound form when
  implementing.
- `--radius-sm/md/lg/xl` from the design collide with shadcn's own existing radius
  scale (already used by every current shadcn component), so they are namespaced
  `--fg-radius-sm/md/lg/xl` instead — NOT registered as Tailwind theme keys, only as
  plain custom properties for arbitrary-value use: `rounded-[var(--fg-radius-md)]`.
  `--radius-none` and `--radius-pill` do not collide, so they kept their design name.
- Shadows are likewise plain custom properties, not Tailwind theme keys: use
  `shadow-[var(--shadow-md)]`.
- Typography tokens (`--text-display-2xl` etc.) are exposed as real Tailwind classes via
  `@utility` (Tailwind v4), since they pack weight/size/line-height/family into one
  `font` shorthand value that the framework's own `--text-*` theme namespace cannot
  hold (it only accepts a size). Usable directly: `className="text-display-2xl"`.
- Multi-line `/* */` comments do not survive inside a `@theme` block in this Tailwind
  v4 + Turbopack setup (`CssSyntaxError: Unclosed string` / `Unknown word`, even though
  the comment is syntactically valid CSS) — keep comments outside `@theme`, or short
  and on one line if they must be inside it.
