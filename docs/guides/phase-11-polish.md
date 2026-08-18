# Phase 11 — Polish, Performance & Optimization

**Thời gian:** ~2 tuần
**Design file:** `i18n.js` + `WebNav.jsx` (theme/lang toggles)
**Kết quả:** App nhanh, responsive hoàn chỉnh, đa ngôn ngữ, SEO tốt, accessible.

---

## Step 1 — Complete i18n coverage

**Prompt:**

```
Read the i18n.js content in my design reference — it has the full
EN and VI string tables.

Audit and complete internationalization:

1. Scan the entire codebase for hardcoded strings:
   - Search for text in JSX that isn't wrapped in t()
   - Check: buttons, labels, placeholders, error messages,
     empty states, toasts, email templates, meta descriptions
   - Create a report of everything found

2. Expand src/messages/en.json and vi.json with all missing keys.
   Organize by namespace:
   {
     "nav": {...}, "auth": {...}, "dashboard": {...},
     "profile": {...}, "browse": {...}, "booking": {...},
     "shop": {...}, "chat": {...}, "reviews": {...},
     "billing": {...}, "errors": {...}, "common": {...}
   }

3. Vietnamese translation quality:
   - Use natural Vietnamese, not literal translation
   - Photography terms: nhiếp ảnh gia (photographer),
     quay phim (videographer), chuyên viên trang điểm (make-up artist),
     studio cho thuê (studio for rent), cửa hàng máy ảnh (camera shop)
   - Booking: đặt lịch, lịch hẹn, xác nhận, hủy
   - Formal but friendly register (use "bạn" not "quý khách")

4. Handle pluralization:
   - Use next-intl's plural syntax:
     "{count, plural, =0 {No reviews} =1 {1 review} other {# reviews}}"
   - Vietnamese has no plural forms — just use the count

5. Date and number formatting:
   - Use next-intl's useFormatter for dates, times, currency
   - VI: dates as "14 tháng 3, 2026", currency as "1.500.000 ₫"
   - EN: "14 March 2026", "$1,500.00"
   - Create src/lib/format.ts with locale-aware helpers

6. Localized routing:
   - URLs: /en/browse and /vi/browse, or use a cookie with
     no URL prefix (simpler for SEO with hreflang)
   - Add hreflang tags in the layout head

7. Email templates in both languages:
   - Detect the recipient's language preference
   - Send the localized template

8. Currency handling:
   - Store prices in VND by default for Vietnamese providers
   - Display converted USD for international viewers (optional)
   - Add a currency preference in user settings
```

---

## Step 2 — Complete responsive design

**Prompt:**

```
Audit and fix responsive behavior across all pages.

Breakpoints (Tailwind defaults):
  sm: 640px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px

Go page by page and implement:

1. LANDING PAGE:
   - Hero: 2 columns → 1 column below lg, image grid below text
   - Hero H1: text-display-2xl → text-display-lg on mobile
   - Search bar: horizontal → stacked vertical below md
   - Featured grid: 4 → 3 (lg) → 2 (md) → 1 (sm)
   - Features: 3 → 1 column below md
   - Footer: 4 → 2 (md) → 1 (sm) columns

2. NAVIGATION:
   - Below lg: hide nav links, show hamburger → Sheet menu
   - Sheet content: nav links, theme toggle, lang toggle,
     auth buttons, all stacked vertically
   - Logo: full → mark only below sm
   - Keep the messages and cart icons visible on mobile

3. AUTH PAGES:
   - Below lg: hide the right visual column entirely
   - Form column becomes full width, centered, max-w-[400px]
   - Reduce vertical padding on mobile

4. DASHBOARD:
   - Below lg: sidebar → Sheet triggered by a menu button
     in a mobile sub-header
   - Stats grid: 4 → 2 (md) → 1 (sm)
   - Booking table → card list below md
     (each booking as a card with stacked fields)
   - Portfolio grid: 4 → 3 → 2 columns

5. PROFILE PAGE:
   - Below lg: booking sidebar moves below the tab content
   - Or: sticky bottom bar with "Book now" that opens a bottom sheet
   - Cover height: 280px → 180px on mobile
   - Avatar: 104px → 80px on mobile
   - Portfolio grid: 3 → 2 columns
   - Tabs: horizontal scroll if they overflow

6. BROWSE:
   - Below lg: filter sidebar → Sheet, triggered by a
     "Filters (3)" button showing the active filter count
   - Results grid: 3 → 2 → 1
   - Sort select stays visible in the header

7. BOOKING FLOW:
   - Progress indicator: full labels → numbers only on mobile
   - Calendar + slots: 2 columns → stacked below md
   - Sticky bottom bar with Back/Continue on mobile

8. MESSAGING:
   - Below lg: list and chat are separate routes
   - /dashboard/messages shows the list
   - /dashboard/messages/[id] shows the chat with a back button
   - Input area: fixed to the bottom with safe-area padding

9. SHOP & CHECKOUT:
   - Product grid: 4 → 3 → 2 → 1
   - Product detail: 2 columns → stacked below lg
   - Cart drawer: 420px → full width on mobile
   - Checkout: summary sidebar moves to the top on mobile,
     collapsible

10. Touch targets:
    - All interactive elements min 44x44px on touch devices
    - Increase padding on buttons and links for mobile
    - Larger tap areas for calendar day cells

Test at: 375px (iPhone SE), 390px (iPhone 14), 768px (iPad),
1024px (iPad landscape), 1440px (desktop).
```

---

## Step 3 — Performance optimization

**Prompt:**

```
Optimize application performance:

1. IMAGES:
   - Audit: every <img> must be next/image
   - Add proper sizes prop for responsive loading:
     Portfolio grid: sizes="(max-width: 768px) 50vw, 33vw"
     Cards: sizes="(max-width: 768px) 100vw, 25vw"
   - Add blurDataURL placeholders:
     Generate a tiny base64 blur on upload, store in the database
     Or use plaiceholder to generate at build time
   - Set priority on above-the-fold images (hero, profile cover)
   - Configure Cloudinary transformations:
     f_auto,q_auto for format and quality optimization
   - Use next.config.js remotePatterns for Cloudinary

2. DATA FETCHING:
   - Convert client-side fetches to Server Components where possible
   - Add loading.tsx for every route segment
   - Use React Suspense boundaries for streaming
   - Parallel data fetching with Promise.all in server components
   - Add unstable_cache for expensive queries:
     Search facets (5 min), landing page featured (10 min),
     category lists (1 hour)

3. DATABASE:
   - Review all Prisma queries: add select to fetch only
     needed fields
   - Check for N+1 queries: use include properly
   - Verify indexes exist for all filtered/sorted columns:
     profiles: (role, isPublished), city, avgRating, createdAt
     bookings: (providerId, status), (customerId, status), date
     messages: (conversationId, createdAt)
     products: (userId, isActive), category
   - Add composite indexes for common query combinations
   - Run EXPLAIN ANALYZE on the search query, optimize

4. BUNDLE SIZE:
   - Run: npx @next/bundle-analyzer
   - Dynamic import heavy components:
     const Chart = dynamic(() => import('./chart'), { ssr: false })
     Apply to: recharts, react-big-calendar, image cropper,
     lightbox, rich text editors
   - Check for duplicate dependencies
   - Tree-shake lucide-react (import individual icons)
   - Remove unused shadcn components

5. CACHING:
   - Set up Redis (Upstash) or Vercel KV for:
     Session data
     Search results (short TTL)
     Rate limiting counters
     Notification unread counts
   - Add Cache-Control headers to API routes:
     Public data: s-maxage=60, stale-while-revalidate=300
     User data: private, no-store

6. FONTS:
   - Use next/font for the chosen font family
   - Subset to latin + vietnamese
   - display: swap
   - Preload only the weights actually used

7. Target metrics (measure with Lighthouse):
   - LCP < 2.5s
   - FID/INP < 200ms
   - CLS < 0.1
   - Performance score > 90 on all main pages
```

---

## Step 4 — SEO

**Prompt:**

```
Implement complete SEO:

1. Metadata on every page:
   - Use generateMetadata for dynamic pages
   - Title format: "{Page} — Fgrapher" (max 60 chars)
   - Description: unique, 150-160 chars, includes keywords
   - Canonical URLs
   - hreflang for EN/VI versions

2. Structured data (JSON-LD):
   - Profile pages: Person or LocalBusiness schema with
     name, image, address, aggregateRating, priceRange,
     areaServed, sameAs (social links)
   - Product pages: Product schema with offers, availability,
     aggregateRating
   - Landing: Organization + WebSite with SearchAction
   - Booking pages: Service schema
   - Reviews: Review schema nested in the parent

3. Open Graph & Twitter cards:
   - Dynamic OG images using @vercel/og:
     Route: /api/og?title=&subtitle=&image=
     Template matching the brand: green-900 background,
     gold accent, logo, provider photo, name, rating
   - Apply to profiles, products, and the landing page

4. Sitemap:
   - Install next-sitemap
   - Generate: static pages + all published profiles +
     all active products + city/role landing pages
   - Split into multiple sitemaps if > 50k URLs
   - Submit to Google Search Console

5. robots.txt:
   - Allow all public pages
   - Disallow: /dashboard, /api, /checkout, /admin

6. City + role landing pages (from Phase 5):
   - Ensure they have unique H1, description, and content
   - Add an intro paragraph per city (can be templated)
   - Internal linking between related city pages

7. Performance for SEO:
   - Server-render all public pages (no client-only content)
   - Ensure content is in the initial HTML
   - Fast TTFB

8. Content:
   - Add a blog section (optional but valuable for SEO):
     /blog with MDX posts about photography tips,
     how to choose a photographer, etc.
```

---

## Step 5 — Accessibility

**Prompt:**

```
Audit and fix accessibility to WCAG 2.1 AA:

1. Semantic HTML:
   - Proper heading hierarchy (one h1 per page, no skipped levels)
   - nav, main, aside, footer landmarks
   - button for actions, a for navigation
   - Lists for grouped items

2. Keyboard navigation:
   - All interactive elements reachable via Tab
   - Visible focus indicators:
     focus-visible:ring-2 focus-visible:ring-gold-500
     focus-visible:ring-offset-2
   - Escape closes modals, sheets, dropdowns
   - Arrow keys navigate: calendar, tabs, dropdowns, lightbox
   - Enter/Space activate buttons
   - Skip to main content link at the top

3. ARIA:
   - aria-label on icon-only buttons
   - aria-current="page" on active nav links
   - aria-expanded on toggles
   - aria-live="polite" on toast container and dynamic counts
   - role="dialog" + aria-modal on modals
   - aria-describedby linking inputs to error messages
   - alt text on all images (empty alt="" for decorative)

4. Forms:
   - Every input has an associated label
   - Error messages linked with aria-describedby
   - Required fields marked with aria-required
   - Form-level error summary at the top on submit failure

5. Color contrast:
   - Verify all text meets 4.5:1 (normal) or 3:1 (large)
   - Check both light and dark themes
   - Particular attention: text-tertiary on bg-surface,
     gold accents on light backgrounds
   - Don't rely on color alone: add icons or text to status badges

6. Motion:
   - Respect prefers-reduced-motion:
     Disable animations, transitions, and auto-playing carousels

7. Screen reader testing:
   - Test with VoiceOver (Mac) or NVDA (Windows)
   - Verify: navigation, forms, dynamic content updates,
     modal focus trapping

8. Run automated checks:
   - Install and run axe-core or Lighthouse accessibility audit
   - Fix all critical and serious issues
```

---

## Step 6 — Error handling & edge cases

**Prompt:**

```
Harden the application:

1. Error boundaries:
   - error.tsx at every route segment
   - Global error.tsx at the root
   - Friendly message + "Try again" + "Go home" buttons
   - Log to Sentry with context

2. Not found:
   - not-found.tsx: custom 404 with search and popular links
   - Handle: deleted profiles, removed products,
     expired booking links

3. API error handling:
   - Consistent error response shape:
     { error: { code, message, details? } }
   - Proper status codes
   - Never leak stack traces or internal details in production
   - Client-side: map error codes to user-friendly messages
     in the translation files

4. Network resilience:
   - Retry failed requests with exponential backoff
   - Offline detection: show a banner when offline
   - Optimistic updates with rollback on failure
   - Queue actions taken while offline (optional)

5. Loading states:
   - Every async operation has a loading indicator
   - Skeleton screens matching the actual content layout
   - Disable buttons during submission with a spinner
   - Prevent double-submission

6. Empty states:
   - Every list has a designed empty state
   - Include: illustration/icon, headline, explanation, CTA
   - Different messages for "no data yet" vs "no results for filter"

7. Form validation:
   - Client-side with zod for instant feedback
   - Server-side always (never trust the client)
   - Show errors inline, near the field
   - Preserve user input on validation failure

8. Edge cases to handle:
   - Very long names/text: truncate with ellipsis + title attribute
   - Missing images: fallback placeholder
   - Deleted user in a conversation: "Deleted user" placeholder
   - Booking with a provider who cancelled their subscription
   - Timezone edge cases: DST transitions, midnight bookings
   - Concurrent edits: last-write-wins with a warning
   - Very large uploads: client-side size check before upload
```

---

## Step 7 — Test & commit

**Prompt:**

```
Run the complete quality audit:

1. Build and lint:
   pnpm build
   pnpm lint
   npx tsc --noEmit

2. Lighthouse on key pages (mobile and desktop):
   - / (landing)
   - /browse
   - /profile/[username]
   - /shop
   Target: Performance 90+, Accessibility 95+, Best Practices 95+,
   SEO 100

3. Responsive testing at all breakpoints:
   375, 390, 768, 1024, 1280, 1440px
   Check every page listed in Step 2

4. i18n testing:
   - Switch to Vietnamese, navigate every page
   - Verify no untranslated strings appear
   - Check date/currency formatting
   - Verify email templates in both languages

5. Accessibility:
   - Run axe DevTools on every page
   - Keyboard-only navigation through a complete booking flow
   - Screen reader test on the main flows

6. Cross-browser:
   - Chrome, Safari, Firefox, Edge
   - iOS Safari, Chrome Android

7. Dark mode:
   - Every page in dark mode
   - Check contrast and that no element is invisible

8. Error scenarios:
   - Disconnect network mid-action
   - Submit forms with invalid data
   - Access pages without permission
   - Visit non-existent URLs

Report all findings with severity.
```

**Git commit:**

```bash
git add .
git commit -m "perf: Phase 11 — i18n coverage, responsive, performance, SEO, accessibility"
```

---

## Checklist hoàn thành Phase 11

- [ ] i18n đầy đủ EN/VI, không còn hardcoded strings
- [ ] Date/currency formatting theo locale
- [ ] Responsive hoàn chỉnh mọi page, mọi breakpoint
- [ ] Images tối ưu (next/image + blur + sizes)
- [ ] Bundle size giảm (dynamic imports)
- [ ] Database indexes đầy đủ
- [ ] Caching layer (Redis/KV)
- [ ] Lighthouse 90+ trên tất cả pages
- [ ] SEO: metadata, JSON-LD, sitemap, OG images
- [ ] Accessibility WCAG 2.1 AA
- [ ] Error boundaries + loading states + empty states
- [ ] Cross-browser tested

**→ Tiếp theo:** Phase 12 — Admin panel & Launch
