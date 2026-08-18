# Phase 5 — Browse & Search

**Thời gian:** ~2 tuần
**Design file:** `BrowseScreen.jsx`
**Kết quả:** Trang tìm kiếm với filter sidebar, search full-text, và grid kết quả. **Đây là mốc MVP — có thể soft launch sau phase này.**

---

## Step 1 — Browse page layout

**Prompt:**

```
Read the BrowseScreen component in my design file.

Create src/app/(public)/browse/page.tsx matching the design EXACTLY:

Server Component that reads searchParams for filters.

Layout:
- max-w-[1240px] mx-auto px-8 pt-8 pb-[72px]
- grid grid-cols-[268px_1fr] gap-8, items-start

LEFT — Filter sidebar (see Step 2)
RIGHT — Results area:

1. Header row (flex items-center justify-between, mb-5):
   - Left block:
     - H1: text-display-md — "Browse artists"
       (or dynamic: "Photographers in Ho Chi Minh City" when filtered)
     - Subtitle: text-body-md, text-secondary
       "{count} results · {sortLabel}"
   - Right: quick filter tags (flex gap-2)
     - Tag "Available now" (toggles availability filter)
     - Tag "Instant book"
     - Tag "Top rated"

2. Results grid: grid grid-cols-3 gap-5
   - ArtistCard components (reuse from Phase 1)
   - Skeleton cards while loading (9 skeletons)

3. Empty state (when no results):
   - Centered, py-20
   - SearchX icon (48px, text-tertiary)
   - Heading: "No artists found"
   - Text: "Try adjusting your filters or searching a different city."
   - Button: "Clear all filters"

4. Pagination / Load more:
   - "Load more" button (secondary, centered) that appends results
   - Or infinite scroll with IntersectionObserver
   - Show "Showing X of Y results"

Responsive:
- < 1280px: results grid becomes 2 columns
- < 1024px: sidebar becomes a Sheet, triggered by a "Filters" button
  in the header row; results grid 2 columns
- < 640px: results grid 1 column
```

---

## Step 2 — Filter sidebar

**Prompt:**

```
Read the BrowseScreen aside element in my design file.

Create src/components/browse/filter-sidebar.tsx matching the design:

Container:
- sticky top-[104px]
- bg-surface-card, rounded-[var(--radius-lg)], shadow-sm
- p-5, flex flex-col gap-[22px]

Sections (separated by divider: h-px bg-border-subtle):

1. ROLE section:
   - Label: text-caption-upper, tracking-[0.08em], text-tertiary — "ROLE"
   - Checkbox list (flex flex-col gap-2.5):
     Photographer, Videographer, Make-up Artist, Studio, Camera Shop
   - Multiple selection allowed
   - Show result count per role: "Photographer (24)"

2. SORT BY section:
   - Label: "SORT BY"
   - Radio list:
     - Top rated (default)
     - Price: low to high
     - Price: high to low
     - Newest
     - Most reviewed

3. City select:
   - Select component, label "City"
   - Options loaded from distinct cities in the database
   - Include "All cities" option
   - Vietnamese cities first: Hồ Chí Minh, Hà Nội, Đà Nẵng, Nha Trang,
     Hội An, Đà Lạt, Cần Thơ, Hải Phòng

4. Budget select:
   - Select, label "Budget"
   - Options: Any, Under ₫2M, ₫2M – ₫5M, ₫5M – ₫15M, Over ₫15M
     (adjust to the currency in use)

5. Categories/Styles (collapsible):
   - Label "STYLE" with expand/collapse chevron
   - Checkbox list of categories relevant to selected roles
   - Show first 6, "Show all" link to expand

6. Availability (collapsible):
   - Date range picker: "Available on"
   - Filters providers who have open slots in that range

7. Rating filter:
   - Radio: Any, 4+ stars, 4.5+ stars

8. Reset button:
   - Button secondary, full width — "Reset filters"
   - Clears all searchParams

State management:
- All filters sync to URL searchParams (shareable links)
- Use nuqs or manual useRouter + useSearchParams
- Debounce updates by 300ms to avoid excessive requests
- Show active filter count badge on the mobile "Filters" button
```

---

## Step 3 — Search API with Prisma

**Prompt:**

```
Create the search API route src/app/api/search/route.ts:

GET /api/search with query params:
- q: string (free text search)
- roles: comma-separated role names
- city: string
- minPrice, maxPrice: numbers
- categories: comma-separated
- minRating: number
- availableFrom, availableTo: ISO dates
- sort: 'rating' | 'price_asc' | 'price_desc' | 'newest' | 'reviews'
- page: number (default 1)
- limit: number (default 24)

Implementation:

1. Build the Prisma where clause dynamically:
   - Only published profiles (isPublished: true)
   - Only profiles whose UserRole has an ACTIVE subscription
     (or is CUSTOMER — but customers don't appear in search)
   - Filter by role if provided
   - Filter by city (case-insensitive contains)
   - Filter by priceMin/priceMax overlap with the requested range
   - Filter by categories (hasSome)
   - Free text search across displayName, description, and user.name
     using Prisma's search or ILIKE

2. For availability filtering:
   - Subquery: providers who have Availability records covering
     the requested dates AND no BlockedDate AND fewer than N
     CONFIRMED bookings on those dates

3. Sorting:
   - rating: order by average review rating desc (use a computed field
     or aggregate)
   - price_asc / price_desc: order by priceMin
   - newest: order by createdAt desc
   - reviews: order by review count desc

4. Include in the response:
   - Profile with user (name, avatar, username)
   - Aggregate rating and review count
   - First 3 portfolio images
   - Role badges

5. Return:
   {
     data: Profile[],
     total: number,
     page: number,
     totalPages: number,
     facets: {
       roles: { role: string, count: number }[],
       cities: { city: string, count: number }[]
     }
   }

Performance:
- Add database indexes for the filtered columns
  (already in schema: role+isPublished, categories)
- Add an index on city
- Use select to fetch only needed fields
- Cache facet counts for 5 minutes

Also create a Prisma migration to add a computed rating column
on Profile (avgRating Float?, reviewCount Int) updated by a trigger
or recalculated when a review is created — this avoids expensive
aggregate queries on every search.
```

---

## Step 4 — Full-text search

**Prompt:**

```
Add proper full-text search to the browse page:

Option A — PostgreSQL native (simpler, good enough to start):
1. Add a search_vector column to the profiles table:
   ALTER TABLE profiles ADD COLUMN search_vector tsvector
   GENERATED ALWAYS AS (
     to_tsvector('simple',
       coalesce(display_name,'') || ' ' ||
       coalesce(description,'') || ' ' ||
       coalesce(shop_name,'')
     )
   ) STORED;
   CREATE INDEX profiles_search_idx ON profiles USING GIN(search_vector);

2. Query with raw SQL via Prisma's $queryRaw when q is present:
   WHERE search_vector @@ plainto_tsquery('simple', $1)
   ORDER BY ts_rank(search_vector, plainto_tsquery('simple', $1)) DESC

3. Handle Vietnamese text: use 'simple' config (not 'english')
   so it doesn't stem incorrectly. Consider unaccent extension
   so "Hô Chi Minh" matches "Hồ Chí Minh".

Create the migration in prisma/migrations/ as a manual SQL migration.

Also build the search input component:

src/components/browse/search-input.tsx:
- Input with Search icon prefix
- Debounced onChange (300ms) that updates the ?q= searchParam
- Clear button (X) when there's text
- Autocomplete dropdown showing:
  - Recent searches (from localStorage)
  - Suggested artists (top 3 matches)
  - Suggested cities
  - "Search for '{query}'" as the last item
- Keyboard navigation: arrows + Enter

Place this search input:
- In the browse page header
- In the WebNav (compact version, expands on focus)
- In the landing hero (already built in Phase 1 — now make it functional)
```

---

## Step 5 — Location-based search

**Prompt:**

```
Add location features:

1. "Near me" button:
   - Uses navigator.geolocation to get user coordinates
   - Sends lat/lng to the search API
   - API calculates distance and filters within radius
   - Show distance on each result card ("2.3 km away")

2. Distance calculation in the API:
   - Use the Haversine formula in raw SQL, or
   - Enable PostGIS extension for proper geo queries:
     CREATE EXTENSION IF NOT EXISTS postgis;
     ALTER TABLE profiles ADD COLUMN location geography(Point, 4326);
   - Add radius filter param: ?lat=&lng=&radius=10 (km)

3. City landing pages for SEO:
   src/app/(public)/[role]/[city]/page.tsx
   - Routes like /photographers/ho-chi-minh, /studios/ha-noi
   - Pre-filtered browse page
   - Custom H1: "Photographers in Ho Chi Minh City"
   - SEO description and structured data
   - generateStaticParams for the top role+city combinations
   - Add to sitemap

4. Map view toggle (optional, nice-to-have):
   - Toggle between grid and map view
   - Map shows pins for each result
   - Click pin → popup with mini ArtistCard
   - Use react-leaflet with OpenStreetMap tiles (free)
```

---

## Step 6 — Social feed (optional for MVP)

**Prompt:**

```
Build a basic social feed. This is optional for the MVP launch —
skip it if you want to launch faster and add it in Phase 11.

1. src/app/(public)/feed/page.tsx:
   - Center column, max-w-[600px] mx-auto
   - Infinite scroll of posts from followed users
   - If not following anyone: show suggested/trending posts

2. Post card component (src/components/cards/post-card.tsx):
   - Header: avatar + name + role badge + timestamp + "..." menu
   - Media: image or video, aspect ratio preserved, rounded
     Multiple media → swipeable carousel with dots
   - Actions row: Like (heart), Comment (message), Share
   - Like count + "Liked by X and Y others"
   - Caption with expandable "more" for long text
   - Comment preview: top 2 comments + "View all X comments"

3. Create post:
   - Floating action button or "Create" in nav (paid roles only)
   - Modal: media upload + caption + category tags
   - POST /api/posts

4. Interactions:
   - POST/DELETE /api/likes
   - POST /api/comments
   - GET /api/posts/feed?page= (posts from followed users)
   - GET /api/posts/explore?page= (trending posts)

5. Explore page:
   - src/app/(public)/explore/page.tsx
   - Masonry grid of trending media
   - Category filter chips at top
```

---

## Step 7 — MVP launch prep

**Prompt:**

```
Prepare for soft launch:

1. Seed realistic demo data:
   - Update prisma/seed.ts with 30-50 realistic profiles
   - Vietnamese names and cities
   - Varied roles, prices, ratings
   - Sample portfolio images (use Unsplash URLs or placeholder service)
   - Sample reviews and bookings

2. Landing page: connect the featured artists section to real data
   - Fetch top-rated profiles from the API
   - Replace the placeholder data

3. Add analytics:
   - Install Plausible or Vercel Analytics
   - Track: page views, search queries, profile views,
     booking button clicks, sign ups

4. Add error monitoring:
   - Install and configure Sentry
   - Wrap API routes with error capture

5. Create essential pages:
   - /about — about Fgrapher
   - /terms — terms of service
   - /privacy — privacy policy
   - /help — FAQ / help center
   - /contact — contact form

6. SEO essentials:
   - Install next-sitemap, generate sitemap.xml
   - Add robots.txt
   - Add JSON-LD structured data on profile pages
     (Person / LocalBusiness schema with aggregateRating)
   - Verify meta tags on all public pages

7. Performance audit:
   - Run Lighthouse, target 90+ on Performance and SEO
   - Optimize images: ensure all use next/image with proper sizes
   - Check bundle size: npx @next/bundle-analyzer
```

---

## Step 8 — Test & commit

**Prompt:**

```
Run the full test:
1. pnpm build
2. pnpm lint
3. pnpm db:seed (with the new realistic data)
4. pnpm dev

Verify:
- /browse loads with all filters visible
- Checking a role filter updates results and URL
- Sort options change result order
- City select filters correctly
- Budget filter works
- Free text search returns relevant results
- Vietnamese text search works (try "nhiếp ảnh", "Hồ Chí Minh")
- "Reset filters" clears everything
- Filter state persists on page refresh (from URL)
- Sharing a filtered URL shows the same results
- Load more / pagination works
- Empty state shows when no results
- "Near me" requests location and filters by distance
- City landing page /photographers/ho-chi-minh works
- Mobile: filters open in a Sheet
- Results grid: 3 → 2 → 1 columns at breakpoints
- Landing page featured section shows real profiles
- Lighthouse score 90+ on /browse and /profile/[username]

Report any issues.
```

**Git commit:**

```bash
git add .
git commit -m "feat(search): Phase 5 — browse page, filters, full-text search, location search"
git tag v0.1.0-mvp
```

---

## 🎉 MVP CHECKPOINT

Sau phase này bạn có thể soft launch. Người dùng thật có thể:
- Đăng ký, chọn role
- Tạo profile với portfolio
- Được tìm thấy qua search
- Xem profile của nhau
- Liên hệ qua thông tin trên profile

Chưa có: booking online, thanh toán, chat. Nhưng đủ để validate product và thu thập feedback.

**Gợi ý:** Chạy soft launch 2-4 tuần, thu feedback, rồi mới build Phase 6-8.

---

## Checklist hoàn thành Phase 5

- [ ] Browse page với layout 268px sidebar + 3-col grid
- [ ] Filter sidebar: role, sort, city, budget, categories, rating
- [ ] Filters sync với URL searchParams
- [ ] Search API với Prisma, đầy đủ filters
- [ ] Full-text search PostgreSQL (hỗ trợ tiếng Việt)
- [ ] Search input với autocomplete
- [ ] Location search ("Near me" + radius)
- [ ] City landing pages cho SEO
- [ ] Empty state + loading skeletons
- [ ] Pagination / infinite scroll
- [ ] Seed data thực tế 30-50 profiles
- [ ] Analytics + Sentry
- [ ] Legal pages + sitemap
- [ ] Lighthouse 90+

**→ Tiếp theo:** Phase 6 — Booking flow
