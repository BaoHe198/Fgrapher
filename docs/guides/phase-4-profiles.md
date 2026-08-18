# Phase 4 — Public Profiles

**Thời gian:** ~2 tuần
**Design file:** `WebProfileScreen.jsx`
**Kết quả:** Trang profile công khai với cover, tabs (Portfolio/Services/Reviews/Gear), và booking sidebar có calendar.

---

## Step 1 — Profile page shell

**Prompt:**

```
Read the WebProfileScreen component in my design file.

Create src/app/(public)/profile/[username]/page.tsx matching the design
EXACTLY:

Server Component — fetch profile data from Prisma by username.
If not found → notFound().

Layout structure:

1. Cover section:
   - MediaPlaceholder (or next/image if coverImage exists)
   - Full width, height 280px, no rounding
   - tint fallback: var(--green-300)

2. Content container:
   - max-w-[1240px] mx-auto px-8 pb-[72px]
   - grid grid-cols-[1fr_360px] gap-10, items-start

3. LEFT COLUMN (main content), mt-[-46px]:

   Identity row (flex gap-[18px] items-end):
   - Avatar: 104px, border-4 border-surface, rounded-full
     (create src/components/ui/avatar.tsx if not exists —
      shows image or initials on a tinted background)
   - Info block (pb-2, flex flex-col gap-1.5):
     - H1: text-display-md — display name
     - Badges row (flex gap-2 items-center):
       - Role badges: one per role (accent tone for primary,
         neutral for secondary)
       - Availability badge: "Available" (success) or
         "Booked out" (warning)
       - StarRating component with rating + review count

   Bio: text-body-lg, text-secondary, max-w-[640px], my-5

   Tabs: Portfolio | Services | Reviews | Gear
   - Gear tab only shows if the user has CAMERA_SHOP role
   - Use the Tabs component from Phase 3

   Tab content (mt-6) — see Step 2

4. RIGHT COLUMN — booking sidebar, see Step 3

Add generateMetadata for SEO:
- title: "{name} — {role} in {city} | Fgrapher"
- description: first 155 chars of bio
- openGraph: images [coverImage], type: 'profile'

Also increment profile.viewCount on each page load (fire-and-forget,
don't block render).
```

---

## Step 2 — Profile tabs content

**Prompt:**

```
Read the WebProfileScreen tabs section in my design file.

Implement the four tab contents:

1. PORTFOLIO TAB:
   - grid grid-cols-3 gap-3
   - Each item: height 200px, rounded-xl, overflow-hidden, cursor-pointer
   - next/image with fill, object-cover
   - Click opens a lightbox (create src/components/modals/media-lightbox.tsx):
     - Full-screen overlay, bg-black/90
     - Centered image, max-h-[85vh]
     - Prev/Next arrows, close X button
     - Keyboard: arrows to navigate, Esc to close
     - Counter "3 / 12" at bottom
   - Empty state: "No portfolio items yet"
   - Load more button if > 12 items

2. SERVICES TAB:
   - flex flex-col gap-3
   - Each service card:
     - bg-surface-card, rounded-[var(--radius-md)], shadow-sm, p-[18px]
     - flex justify-between items-center
     - Left: service name (text-heading-sm) +
       description (text-body-sm, text-secondary) +
       duration chip (e.g., "2 hours")
     - Right (flex gap-3.5 items-center):
       - Price: text-heading-sm
       - Button (sm, secondary): "Book"
         → scrolls to booking sidebar and pre-selects this service
   - Empty state: "No service packages listed"

3. REVIEWS TAB:
   - Rating summary card at top:
     - Big average number (text-display-lg) + stars
     - Breakdown bars: 5★ through 1★ with percentage bars
       (bg-gold-400 fill, bg-neutral-200 track, h-2, rounded-full)
     - Total review count
   - Review list (flex flex-col gap-[18px]):
     Each review (flex gap-3):
     - Avatar 40px
     - Content block:
       - Name: text-heading-sm
       - StarRating (small)
       - Date: text-body-sm, text-tertiary
       - Review text: text-body-md, text-secondary
       - Photos (if any): small thumbnail row
       - Provider response (if any): indented block with
         border-l-2 border-brand-primary, pl-3, mt-2
   - Sort dropdown: Newest | Highest | Lowest
   - Empty state: "No reviews yet"

4. GEAR TAB (Camera Shop role only):
   - grid grid-cols-3 gap-4
   - Each product card:
     - bg-surface-card, rounded-[var(--radius-md)], shadow-sm,
       overflow-hidden
     - Image: height 120px
     - Body (p-3.5, flex flex-col gap-1.5):
       - Badge: "Rental" (accent) or "For sale" (neutral)
       - Name: text-heading-sm
       - Price: text-body-md, font-semibold
     - Click → /shop/[productId]
   - "View all gear" link at bottom

Data fetching: all tab data comes from the server component's initial
query. Use Prisma include to fetch profile with media, services,
reviews, and products in one query.
```

---

## Step 3 — Booking sidebar with calendar

**Prompt:**

```
Read the WebProfileScreen booking sidebar in my design file — it has
a 7-day calendar strip and time slots.

Create src/components/profile/booking-sidebar.tsx:

Container: sticky top-[104px], bg-surface-card,
rounded-[var(--radius-lg)], shadow-md, p-5, flex flex-col gap-4

1. Header:
   - H3: text-heading-lg — "Book {firstName}"
   - Starting price: text-body-md, text-secondary
     e.g., "From $150 per session"

2. Service selector (if provider has services):
   - Select component with service options
   - Shows name + price

3. Calendar strip:
   - Label: text-caption-upper, text-tertiary — "SELECT A DATE"
   - Week navigation row: < Previous | Month Year | Next >
   - 7-day grid (grid grid-cols-7 gap-1.5):
     Each day button:
     - flex flex-col items-center gap-1, py-2, rounded-[var(--radius-sm)]
     - Day-of-week label: text-body-sm, text-tertiary (Mon, Tue...)
     - Day number: text-body-md, font-semibold
     - States:
       Available: bg-transparent, hover:bg-sunken, cursor-pointer
       Selected: bg-brand-primary, text-on-brand
       Busy/unavailable: text-tertiary, opacity-40, cursor-not-allowed,
         with a small dot indicator below
       Today: border border-brand-primary

4. Time slots (shown after a date is selected):
   - Label: text-caption-upper, text-tertiary — "AVAILABLE TIMES"
   - grid grid-cols-2 gap-2
   - Each slot button:
     - py-2.5, rounded-[var(--radius-sm)], text-body-md, font-semibold
     - Unselected: border border-default, bg-surface
     - Selected: bg-brand-primary, text-on-brand, border-transparent
   - If no slots: "No times available on this date"

5. Summary (shown after date + time selected):
   - Divider line
   - Rows: Service, Date, Time, Duration
   - Total row: font-bold, text-heading-sm

6. CTA:
   - Button accent, lg, full width — "Book now"
     → navigates to /booking/[providerId]?service=&date=&time=
   - Button ghost, full width — "Message {firstName}"
     → opens chat or navigates to /dashboard/messages?to={userId}

7. Trust signals below:
   - flex flex-col gap-2, text-body-sm, text-secondary
   - "Free cancellation up to 48h before"
   - "Response time: usually within 2 hours"

Fetch availability:
- GET /api/availability/[providerId]?from=&to=
  Returns: { dates: [{ date, slots: [{ time, available }] }] }
  Logic: combine the provider's weekly Availability records,
  subtract BlockedDate entries, subtract existing CONFIRMED bookings

Mobile behavior (< 1024px):
- Sidebar moves below the tabs content
- Or: sticky bottom bar with "Book now" that opens a bottom sheet
```

---

## Step 4 — Profile editor (dashboard side)

**Prompt:**

```
Enhance src/app/(dashboard)/settings/profile/page.tsx from Phase 3
to be a complete profile editor with live preview:

Layout: grid grid-cols-[1fr_400px] gap-8
- Left: the edit form
- Right: live preview card (sticky) showing how the profile will look

Form sections (each in a Card):

1. Cover & avatar:
   - Cover uploader: 3:1 aspect ratio drop zone with current image
   - Avatar uploader: circular, 104px
   - Both use Cloudinary signed upload
   - Crop tool (react-easy-crop) before upload

2. Basic info:
   - Display name
   - Username (with real-time availability check via
     GET /api/users/check-username?u=)
   - Bio (textarea, 500 chars, with counter)
   - Tagline (short one-liner, 80 chars)

3. Location:
   - City (select from a predefined list, or Google Places autocomplete)
   - District/Area (input)
   - Full address (only for STUDIO role)
   - Map preview showing the pin (optional, using a static map image)

4. Categories & styles:
   - Multi-select chips using the Tag component
   - Options depend on role:
     Photographer/Videographer: Wedding, Portrait, Fashion, Commercial,
       Event, Product, Food, Landscape, Street, Documentary, Music Video,
       Corporate, Real Estate
     Make-up Artist: Bridal, Editorial, SFX, Natural, Glam
     Studio: Indoor, Outdoor, Rooftop, Cyclorama, Green Screen

5. Pricing:
   - Price range: min and max number inputs
   - Currency select (VND, USD)
   - Note: "Shown as 'From ₫X' on your profile"

6. Studio-specific (only for STUDIO role):
   - Area in square meters
   - Amenities: checkbox grid (WiFi, AC, Parking, Changing room,
     Makeup station, Kitchen, Sound system, Backdrop, Lighting kit)
   - House rules (textarea)

7. Social links:
   - Website, Instagram, Facebook, TikTok, YouTube

8. Services (separate section with CRUD):
   - List of current service packages
   - Add service button → modal with: name, description, duration,
     price, active toggle
   - Edit/delete each service

9. Availability settings:
   - Weekly schedule: for each day, toggle + time range pickers
   - Blocked dates: calendar to click and block specific dates
   - Slot duration select: 1hr, 2hr, half-day, full-day
   - Buffer time between bookings

10. Publish toggle:
    - Switch: "Profile is live"
    - Warning if profile incomplete: lists what's missing

Sticky save bar at bottom:
- Shows "Unsaved changes" indicator
- Save button (accent) + Discard button (ghost)
- Auto-save draft to localStorage as a safety net

API routes:
- GET/PATCH /api/profiles/[role]
- GET /api/users/check-username
- POST/PATCH/DELETE /api/services
- GET/PUT /api/availability
- POST/DELETE /api/blocked-dates
```

---

## Step 5 — Follow system & saved profiles

**Prompt:**

```
Add social features to profiles:

1. Follow button on public profile:
   - Position: next to the identity block, or in the booking sidebar
   - States: "Follow" (secondary) / "Following" (ghost with check icon)
   - Optimistic UI update
   - Show follower count on profile

2. Save/bookmark button:
   - Heart or bookmark icon button
   - Toggles saved state
   - Shows in the customer's "Saved artists" list

3. Share button:
   - Dropdown: Copy link, Share to Facebook, Share to X,
     Share via WhatsApp
   - Copy link shows a toast confirmation

4. src/app/(dashboard)/saved/page.tsx:
   - Grid of saved profiles using ArtistCard
   - Remove from saved action
   - Empty state

API routes:
- POST/DELETE /api/follows — follow/unfollow
- POST/DELETE /api/saved-profiles — save/unsave
- GET /api/saved-profiles — list user's saved profiles
- GET /api/users/[id]/followers and /following
```

---

## Step 6 — Test & commit

**Prompt:**

```
Run the full test:
1. pnpm build
2. pnpm lint
3. pnpm dev

Verify:
- Visit /profile/[username] for a seeded photographer
- Cover image and avatar render correctly with the -46px offset
- All 4 tabs switch and load content
- Portfolio lightbox opens, arrows navigate, Esc closes
- Services show with Book buttons
- Reviews tab shows rating breakdown bars
- Gear tab only appears for Camera Shop accounts
- Booking sidebar: calendar shows 7 days, busy days grayed
- Selecting a date loads time slots
- Selecting a time enables "Book now" button
- Sidebar is sticky while scrolling
- Follow and Save buttons toggle correctly
- Profile editor: all fields save and persist
- Live preview updates as you type
- SEO: view page source, check meta tags and OG tags
- Dark mode on all profile pages
- Responsive: sidebar moves below content on mobile

Report any issues.
```

**Git commit:**

```bash
git add .
git commit -m "feat(profiles): Phase 4 — public profile page, tabs, booking sidebar, profile editor"
```

---

## Checklist hoàn thành Phase 4

- [ ] Profile page với cover + avatar offset
- [ ] 4 tabs: Portfolio, Services, Reviews, Gear
- [ ] Media lightbox với keyboard navigation
- [ ] Rating breakdown bars
- [ ] Booking sidebar sticky với calendar strip 7 ngày
- [ ] Time slots load theo ngày được chọn
- [ ] Availability API kết hợp schedule + blocked dates + bookings
- [ ] Profile editor với live preview
- [ ] Services CRUD
- [ ] Availability settings (weekly schedule + blocked dates)
- [ ] Follow / Save / Share
- [ ] SEO meta tags + OG images

**→ Tiếp theo:** Phase 5 — Browse & Search
