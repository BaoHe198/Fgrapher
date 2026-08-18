# Phase 1 — Landing Page & Navigation

**Thời gian:** ~1 tuần
**Design file:** `LandingScreen.jsx`, `WebNav.jsx`
**Kết quả:** Trang chủ công khai hoàn chỉnh, có navigation sticky, dark mode, đa ngôn ngữ EN/VI.

---

## Chuẩn bị

### Bước 0.1 — Copy design reference vào project

```bash
mkdir -p docs/design-reference
cp ~/Downloads/Fgrapher_Web_UI_Kit.html docs/design-reference/
```

### Bước 0.2 — Cài dependencies cần cho phase này

Mở Claude Code, paste:

```
Install these packages:
- next-themes (dark mode)
- lucide-react (icons)
- next-intl (internationalization for EN/VI)

Then set up:
1. ThemeProvider from next-themes in src/app/layout.tsx with attribute="class"
2. Add darkMode: 'class' to tailwind.config.ts
```

---

## Step 1 — Map design tokens vào Tailwind

**Prompt cho Claude Code:**

```
Read docs/design-reference/Fgrapher_Web_UI_Kit.html and extract the CSS
variables from the :root and :root[data-theme="dark"] blocks.

Then update tailwind.config.ts and src/app/globals.css:

1. In globals.css, add all the CSS custom properties from my design:
   - Brand green scale (--green-50 through --green-950), hue 168
   - Brand gold scale (--gold-50 through --gold-900), hue 38
   - Warm greige neutrals (--neutral-0 through --neutral-950), hue 30
   - Semantic tokens: --brand-primary, --brand-accent, --bg-page,
     --bg-surface, --bg-sunken, --text-primary, --text-secondary,
     --text-tertiary, --border-subtle, --border-default, --surface-card
   - Status colors: --success, --warning, --danger, --info (+ their -bg variants)
   - Include the dark mode overrides under .dark selector
     (my design uses [data-theme="dark"], convert to .dark for next-themes)

2. In tailwind.config.ts, extend the theme to reference these variables:
   colors: {
     green: { 50: 'var(--green-50)', ... 950: 'var(--green-950)' },
     gold: { 50: 'var(--gold-50)', ... 900: 'var(--gold-900)' },
     neutral: { 0: 'var(--neutral-0)', ... 950: 'var(--neutral-950)' },
     brand: { primary: 'var(--brand-primary)', accent: 'var(--brand-accent)' },
     surface: { DEFAULT: 'var(--bg-surface)', card: 'var(--surface-card)',
                sunken: 'var(--bg-sunken)' },
     ...
   }

3. Also extract the typography tokens (--text-display-2xl, --text-display-md,
   --text-heading-lg, --text-heading-md, --text-heading-sm, --text-body-lg,
   --text-body-md, --text-body-sm, --text-caption-upper) and the radius
   tokens (--radius-sm, --radius-md, --radius-lg, --radius-pill) and
   shadow tokens (--shadow-sm, --shadow-md, --shadow-lg).

Verify: run pnpm build to confirm no errors.
```

**Kiểm tra:** Mở `src/app/globals.css`, phải thấy đầy đủ các biến CSS. Chạy `pnpm dev`, không lỗi.

---

## Step 2 — Tạo logo assets

**Prompt:**

```
Create the Fgrapher logo as React components in src/components/brand/:

1. logo-mark.tsx — the icon only:
   Two overlapping rounded squares:
   <svg viewBox="0 0 200 200">
     <rect x="20" y="20" width="120" height="120" rx="18" fill="none"
           stroke="#123832" stroke-width="14"/>
     <rect x="60" y="60" width="120" height="120" rx="18" fill="none"
           stroke="#C9A66B" stroke-width="14" style="mix-blend-mode:multiply"/>
   </svg>

   For dark mode, the first rect stroke becomes #F7F1E6 and remove
   the mix-blend-mode. Use the useTheme hook from next-themes to switch.

   Props: size (default 28), className

2. logo-full.tsx — icon + "Fgrapher" wordmark:
   Horizontal layout, gap 10px, wordmark uses text-heading-lg style,
   color text-primary. Clickable, links to "/".

   Props: size, className, href (default "/")
```

---

## Step 3 — Xây dựng Navigation

**Prompt:**

```
Read the WebNav component in my design file.

Create src/components/layout/web-nav.tsx matching the design EXACTLY:

Structure:
- <header> sticky top-0, z-20
- Background: color-mix(in srgb, var(--bg-surface) 88%, transparent)
- backdrop-blur-[14px], border-b border-subtle
- Inner container: max-w-[1240px] mx-auto px-6, height 72px, flex items-center gap-6

Left section:
- Logo (LogoFull component), clickable → "/"
- flex-shrink-0

Center nav links (flex gap-[18px]):
- Browse → /browse
- Studios → /browse?role=STUDIO
- Shop → /shop
- Pricing → /pricing
- Style: text-body-md, font-semibold
- Active link: text-primary. Inactive: text-secondary
- Responsive: on viewport < 1180px, only show "Browse" and "Pricing"
  (use a resize listener with useState, matching my design's approach)

Right section (flex items-center gap-3, ml-auto):
- MessageCircle icon (20px, text-secondary) — only on >= 1180px
- ShoppingBag icon (20px, text-secondary) — only on >= 1180px
- ThemeToggle component (see below)
- LangToggle component (see below)
- "Sign in" button (ghost variant, sm size) → /login
- "Dashboard" button (secondary variant, sm size) → /dashboard
- Avatar (34px) — only when user is logged in

ThemeToggle (separate component in same file):
- 36x36px, rounded-full, border border-subtle, bg-surface
- Icon: Moon when light theme, Sun when dark theme
- onClick toggles theme via next-themes setTheme
- transition-colors duration-150

LangToggle (separate component):
- inline-flex, border border-subtle, rounded-full, overflow-hidden, bg-surface
- Two buttons: "EN" and "VI"
- Active button: bg-brand-primary, text-on-brand
- Inactive: transparent bg, text-secondary
- padding: 7px 12px, text-body-sm, font-bold
- transition-colors duration-150

Use next/link for navigation, usePathname for active state.
Use lucide-react for icons.
```

**Kiểm tra:** Nav hiển thị đúng, click theme toggle chuyển dark/light, responsive khi thu nhỏ cửa sổ.

---

## Step 4 — Tạo shared UI components

**Prompt:**

```
Read my design file and create these reusable components that appear
across multiple screens. Put them in src/components/ui/:

1. button.tsx — variants matching my design:
   - primary: bg-brand-primary, text-on-brand
   - accent: bg-gold-400, text-neutral-900 (main CTA style)
   - secondary: bg-surface, border border-default, text-primary
   - ghost: transparent, text-secondary, hover:bg-sunken
   Sizes: sm (padding 7px 12px), md (10px 16px), lg (14px 24px)
   All: rounded-[var(--radius-md)], font-semibold, transition 150ms

2. badge.tsx — tone variants:
   - success: bg-success-bg, text-success
   - warning: bg-warning-bg, text-warning
   - accent: bg-gold-100, text-gold-800
   - neutral: bg-neutral-100, text-neutral-700
   Style: inline-flex, px-2.5 py-1, rounded-full, text-body-sm, font-semibold

3. tag.tsx — pill filter chips:
   - default: border border-default, bg-surface, text-secondary
   - selected: bg-brand-primary, text-on-brand, border-transparent
   Style: px-3.5 py-2, rounded-full, text-body-sm, font-semibold, cursor-pointer

4. card.tsx — surface container:
   - bg-surface-card, rounded-[var(--radius-lg)], shadow-sm
   - Prop: padding (boolean, default true → p-5)

5. media-placeholder.tsx — the WMedia component from my design:
   - Colored rectangle placeholder for images not yet uploaded
   - Props: tint (CSS color), height (number or string), radius (number),
     label (optional text)
   - Renders a div with the tint background, rounded corners
   - Will be replaced by next/image once real uploads exist

6. star-rating.tsx — the WStars component:
   - Display mode: star icon (gold-500 fill) + rating number + "(reviews)"
   - Style: inline-flex items-center gap-1, text-body-sm
   - Props: rating (string/number), reviews (number), size (default 16)

7. section-head.tsx — the SectionHead component:
   - Flex row, justify-between, items-center, mb-5
   - Left: h2 title (text-display-md)
   - Right: optional action link (text-body-md, font-semibold, text-link)

Match colors, spacing, and typography from my design exactly.
Use cn() helper for className merging.
```

---

## Step 5 — Xây dựng ArtistCard

**Prompt:**

```
Read the ArtistCard component in my design file (used in LandingScreen
and BrowseScreen).

Create src/components/cards/artist-card.tsx:

Structure:
- Card container: bg-surface-card, rounded-[var(--radius-lg)],
  shadow-sm, overflow-hidden, cursor-pointer
- hover: shadow-md, transition 150ms

Top: MediaPlaceholder (or next/image when available)
- height 180px, no radius (parent clips it)
- tint prop from artist data

Body (p-4, flex flex-col gap-2):
- Row 1: name (text-heading-sm, font-semibold) + role Badge (accent tone)
- Row 2: city (text-body-sm, text-secondary) with MapPin icon 14px
- Row 3: StarRating component (rating + review count)
- Row 4: price (text-body-md, font-semibold, text-primary)

Props:
interface ArtistCardProps {
  artist: {
    id: string
    name: string
    username: string
    role: string
    city: string
    rating: string | number
    reviews: number
    price: string
    coverImage?: string
    tint?: string
  }
  onClick?: () => void
}

Default behavior: link to /profile/[username] via next/link.
```

---

## Step 6 — Xây dựng Landing Page

**Prompt:**

```
Read the LandingScreen component in my design file.

Create src/app/(public)/page.tsx matching the design EXACTLY.
Use the components from Steps 4-5. Build these sections in order:

SECTION 1 — HERO:
- <section> bg-green-900, text-gold-50, relative
- Inner: max-w-[1240px] mx-auto px-8, grid-cols-[1.05fr_1fr] gap-14,
  items-center, min-h-[520px]

  Left column (flex flex-col gap-[22px] py-16):
  - Eyebrow: text-caption-upper, tracking-[0.14em], text-gold-300
    Content: "BOOK CREATIVE TALENT"
  - H1: text-display-2xl, tracking-[-0.02em], margin 0
    Content: "Find Your Artist"
  - Subtitle: text-body-lg, text-green-200, max-w-[460px]
    Content: "Photographers, videographers, make-up artists, studios,
    and gear — all in one place."
  - Search bar: bg-surface, rounded-[var(--radius-lg)], p-2.5,
    flex gap-2 items-center, shadow-lg, max-w-[560px]
      - Search icon (18px, text-tertiary) + placeholder text "What do you need?"
      - Vertical divider (1px, height 26px, bg-border-subtle)
      - MapPin icon (18px) + "City" text
      - Button (accent variant) "Search" → /browse
  - Role filter tags: flex gap-2 flex-wrap
    Tags: Photographer, Videographer, Make-up Artist, Studio, Camera Shop
    (clickable, one selected at a time)

  Right column (grid-cols-2 gap-3 py-10):
  - Left sub-column (flex flex-col gap-3):
    MediaPlaceholder tint=green-300 height=200 radius=16
    MediaPlaceholder tint=gold-200 height=140 radius=16
  - Right sub-column (flex flex-col gap-3 pt-[34px]):
    MediaPlaceholder tint=neutral-300 height=150 radius=16
    MediaPlaceholder tint=green-200 height=190 radius=16

SECTION 2 — FEATURED ARTISTS:
- max-w-[1240px] mx-auto px-8 py-[72px]
- SectionHead: title "Featured artists", action "See all" → /browse
- Grid: grid-cols-4 gap-5, 4 ArtistCard components
- Use placeholder data for now (will connect to API in Phase 5)

SECTION 3 — FEATURES:
- bg-surface, border-y border-subtle
- Inner: max-w-[1240px] mx-auto px-8 py-16, grid-cols-3 gap-8
- Each feature (flex flex-col gap-2.5):
  - Icon circle: 44x44px, rounded-[var(--radius-md)], bg-success-bg,
    inline-flex center. Icon 22px, text-brand-primary
  - H3: text-heading-md
  - P: text-body-md, text-secondary
- Three features:
  1. Search icon — "Discover talent" — "Browse verified photographers,
     videographers, and studios near you."
  2. CalendarCheck icon — "Book instantly" — "See real availability and
     lock in your date in minutes."
  3. ShoppingBag icon — "Rent or buy gear" — "Camera shops list equipment
     for rent and sale."

SECTION 4 — HOW IT WORKS:
- max-w-[1240px] mx-auto px-8 py-[72px]
- SectionHead: "How it works"
- Grid-cols-3 gap-8, numbered steps
- Each: number badge (32px circle, bg-brand-primary, text-on-brand,
  font-bold) + heading + description

SECTION 5 — CTA:
- bg-green-900, text-gold-50
- Inner: max-w-[1240px] mx-auto px-8 py-20, text-center
- H2: text-display-lg — "Ready to get booked?"
- P: text-body-lg, text-green-200, max-w-[520px] mx-auto
- Buttons row: "Create your profile" (accent) + "Browse artists" (secondary)

FOOTER:
- bg-surface, border-t border-subtle
- Inner: max-w-[1240px] mx-auto px-8 py-14
- Grid-cols-4 gap-8:
  Col 1: Logo + tagline "Find Your Artist" (text-body-sm, text-secondary)
  Col 2: "For Artists" — Create profile, Pricing, Success stories
  Col 3: "For Clients" — Browse, How it works, Help center
  Col 4: "Company" — About, Terms, Privacy, Contact
- Bottom row: border-t border-subtle pt-6 mt-10,
  "© 2026 Fgrapher. All rights reserved."

Make the whole page responsive:
- < 1024px: hero becomes 1 column, featured grid becomes 2 columns
- < 768px: all grids become 1 column, reduce padding to px-5
```

**Kiểm tra:** Chạy `pnpm dev`, mở `localhost:3000`. So sánh với design gốc trong Claude Design.

---

## Step 7 — Setup i18n (EN/VI)

**Prompt:**

```
Read the i18n.js file content in my design reference — it contains
window.FG_STRINGS with 'en' and 'vi' translation objects.

Set up internationalization:

1. Install and configure next-intl:
   - Create src/i18n/routing.ts with locales ['en', 'vi'], defaultLocale 'en'
   - Create src/i18n/request.ts
   - Add middleware for locale detection

2. Create translation files:
   - src/messages/en.json — extract all English strings from my design
   - src/messages/vi.json — extract all Vietnamese strings from my design
   Keep the same key structure (nav.browse, hero.title, auth.email, etc.)

3. Update all components built so far to use translations:
   - Replace hardcoded strings with t('key')
   - Import: import { useTranslations } from 'next-intl'

4. Connect the LangToggle in WebNav to actually switch locale
   (use next-intl's router and pathname)

5. Store locale preference in a cookie

Verify: switching EN → VI changes all text on the landing page.
```

---

## Step 8 — Test & commit

**Prompt:**

```
Run the full check:
1. pnpm build — confirm no TypeScript or build errors
2. pnpm lint — fix any lint issues
3. pnpm dev — start dev server

Then verify manually and report any issues:
- Landing page renders all 5 sections + footer
- Navigation is sticky and blurs on scroll
- Theme toggle switches light/dark, all colors adapt
- Language toggle switches EN → VI
- Responsive: test at 1440px, 1024px, 768px, 375px
- All links navigate correctly
- No console errors
```

**Git commit:**

```bash
git add .
git commit -m "feat(landing): Phase 1 — landing page, navigation, design tokens, i18n"
```

---

## Checklist hoàn thành Phase 1

- [ ] Design tokens mapped vào Tailwind + globals.css
- [ ] Logo components (mark + full)
- [ ] Navigation sticky với theme toggle + lang toggle
- [ ] 7 shared UI components (Button, Badge, Tag, Card, MediaPlaceholder, StarRating, SectionHead)
- [ ] ArtistCard component
- [ ] Landing page với 5 sections + footer
- [ ] Dark mode hoạt động toàn bộ
- [ ] i18n EN/VI hoạt động
- [ ] Responsive ở mọi breakpoint
- [ ] Build pass, không lỗi console

**→ Tiếp theo:** Phase 2 — Authentication screens
