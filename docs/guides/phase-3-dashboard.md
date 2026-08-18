# Phase 3 — Dashboard

**Thời gian:** ~2 tuần
**Design file:** `DashboardScreen.jsx`
**Kết quả:** Dashboard đầy đủ với sidebar, stats cards, và 5 tabs (Bookings, Portfolio, Listings, Messages, Settings).

---

## Step 1 — Dashboard layout & sidebar

**Prompt:**

```
Read the DashboardScreen component in my design file.

Create the dashboard shell:

1. src/app/(dashboard)/layout.tsx:
   - Include WebNav at top (the same one from Phase 1)
   - Below nav: container max-w-[1240px] mx-auto px-8 pt-8 pb-[72px]
   - Grid: grid-cols-[232px_1fr] gap-8, items-start
   - Left: DashboardSidebar component
   - Right: {children}
   - Responsive: < 1024px → single column, sidebar becomes a Sheet
     triggered by a hamburger button in a mobile sub-header

2. src/components/layout/dashboard-sidebar.tsx:

   Container: sticky top-[104px], flex flex-col gap-1

   Nav items (each a Link):
   - Overview → /dashboard — icon LayoutDashboard
   - Bookings → /dashboard/bookings — icon Calendar
   - Portfolio → /dashboard/portfolio — icon Image
   - Listings → /dashboard/listings — icon ShoppingBag
   - Messages → /dashboard/messages — icon MessageCircle
   - Settings → /dashboard/settings — icon Settings

   Item styling:
   - flex items-center gap-2.5, px-3 py-2.5
   - rounded-[var(--radius-sm)]
   - text-body-md, font-semibold
   - Inactive: text-secondary, transparent bg
   - Active: bg-success-bg, text-brand-primary
   - hover (inactive): bg-sunken
   - Icon size 18px

   Role-based visibility (use useUserRoles hook):
   - Portfolio: only if canUpload (any paid role)
   - Listings: only if canSell (CAMERA_SHOP role)
   - Bookings: always visible, but label changes:
     "Bookings" for providers, "My bookings" for customers only

   Plan card at bottom (mt-3.5, p-3.5):
   - bg-green-900, text-gold-50, rounded-[var(--radius-md)]
   - flex flex-col gap-2
   - Span: text-body-sm, text-green-200 — "Current plan"
   - Span: text-heading-sm — the plan name (e.g., "Pro — Photographer")
     or "Free — Customer" if no paid role
   - Button accent sm: "Manage plan" → /dashboard/settings/billing

Use usePathname for active state detection.
```

---

## Step 2 — Dashboard home (Overview)

**Prompt:**

```
Read the DashboardScreen component, focus on the header and stats cards.

Create src/app/(dashboard)/dashboard/page.tsx:

1. Header row (flex items-center justify-between):
   - H1: text-display-md — dynamic greeting:
     "Good morning, {firstName}" / "Good afternoon" / "Good evening"
     based on current hour
   - Right: Switch component "Accepting bookings"
     (only visible for provider roles)
     Connected to a user setting — toggling calls
     PATCH /api/users/me with { acceptingBookings: boolean }

2. Stats row: grid grid-cols-4 gap-4
   Each stat as a Card (flex flex-col gap-1.5):
   - Label: text-body-sm, text-secondary
   - Value: text-display-md

   Stats for provider roles:
   - "Pending requests" — count of PENDING bookings
   - "Confirmed" — count of CONFIRMED bookings this month
   - "Earnings" — sum of COMPLETED booking totals this month, formatted
   - "Profile views" — profile.viewCount

   Stats for customer-only:
   - "Upcoming bookings"
   - "Saved artists"
   - "Messages"
   - "Orders"

   Responsive: grid-cols-2 on tablet, grid-cols-1 on mobile

3. Recent activity section below stats:
   - SectionHead: "Recent activity"
   - List of recent events (bookings, messages, reviews)
   - Each row: icon + text + timestamp
   - Empty state: illustration + "No activity yet" + CTA button

4. Quick actions (only if profile incomplete):
   - Card with warning tone
   - Progress bar showing profile completion %
   - "Complete your profile" button → /dashboard/settings/profile

Create the API route src/app/api/dashboard/stats/route.ts:
- requireAuth()
- Query Prisma for the relevant counts based on user's roles
- Return { pending, confirmed, earnings, views } or customer equivalents
- Use Promise.all for parallel queries
```

---

## Step 3 — Bookings tab

**Prompt:**

```
Read the DashboardScreen bookings tab in my design file — it's a table.

Create src/app/(dashboard)/bookings/page.tsx:

1. Tabs at top (use a Tabs component matching my design):
   Create src/components/ui/tabs.tsx first:
   - flex gap-1, border-b border-subtle
   - Each tab: px-4 py-3, text-body-md, font-semibold, cursor-pointer
   - Inactive: text-secondary, border-b-2 border-transparent
   - Active: text-primary, border-b-2 border-brand-primary
   - transition 150ms

   Tabs: All | Pending | Confirmed | Completed | Cancelled

2. Bookings table (Card with padding={false}):

   Header row:
   - grid grid-cols-[1.2fr_1.2fr_1.4fr_0.8fr_0.9fr_auto]
   - px-5 py-3.5, border-b border-subtle
   - text-caption-upper, tracking-[0.06em], text-tertiary
   - Columns: Client | Service | When | Total | Status | Actions

   Data rows:
   - Same grid, px-5 py-4, border-b border-subtle, items-center
   - text-body-md
   - Client: font-semibold + small avatar (28px)
   - Service: text-secondary
   - When: text-secondary, format "Sat 14 Mar · 2:00 pm"
   - Total: font-semibold, currency formatted
   - Status: Badge component
     PENDING → warning tone
     CONFIRMED → success tone
     COMPLETED → neutral tone
     CANCELLED / DECLINED → danger tone
   - Actions column:
     For PENDING (provider view): "Accept" button (sm, accent) +
       "Decline" button (sm, ghost)
     For CONFIRMED: "Message" button (sm, secondary) + dropdown menu
       with "Mark complete", "Cancel"
     For customer view: "View details" + "Cancel" if not yet past

3. Empty state:
   - Centered, py-16
   - Calendar icon (48px, text-tertiary)
   - Heading: "No bookings yet"
   - Text: "When clients book you, they'll appear here."
   - Button (for providers): "Share your profile"

4. Pagination at bottom if > 20 bookings

API routes needed:
- GET /api/bookings?status=&page= — list with filters, paginated
  Provider sees bookings where providerId = session.user.id
  Customer sees bookings where customerId = session.user.id
- PATCH /api/bookings/[id] — update status
  Validate: only provider can accept/decline
  Only participants can cancel
  Send email notification on status change
```

---

## Step 4 — Portfolio tab

**Prompt:**

```
Read the DashboardScreen portfolio tab — it's a 4-column image grid with
an upload card.

Create src/app/(dashboard)/portfolio/page.tsx:

Access control: only users with canUpload (paid roles) can access.
Customer-only users see an upsell card instead.

1. Header:
   - SectionHead: "Portfolio" with action button "Upload media"
   - Subtitle: "{count} items · Drag to reorder"

2. Media grid: grid grid-cols-4 gap-3.5
   Each item:
   - Aspect ratio 4:3, rounded-xl, overflow-hidden, relative, group
   - Image (next/image) or MediaPlaceholder while loading
   - Hover overlay (absolute inset-0, bg-black/50, opacity-0
     group-hover:opacity-100, transition):
     - Top-right: delete button (X icon, white)
     - Bottom: title text (if set)
   - Drag handle for reordering

3. Upload card (last item in grid):
   - Same size as media items
   - border-2 border-dashed border-default, rounded-xl
   - flex flex-col items-center justify-center gap-2
   - Upload icon (22px) + text "Upload" (text-body-sm)
   - text-tertiary, cursor-pointer
   - hover: border-brand-primary, text-brand-primary
   - Click opens the upload modal

4. Upload modal (src/components/modals/upload-media-modal.tsx):
   - Dialog component (create in ui/ if not exists)
   - Drag-and-drop zone (react-dropzone)
   - Accepts: images (jpg, png, webp) and videos (mp4, mov)
   - Max size: 10MB images, 100MB videos
   - Multiple file selection
   - Preview thumbnails with progress bars
   - Fields per file: title (optional), category (select)
   - Upload to Cloudinary via signed upload
   - Show upload progress %

5. Reordering:
   - Use @dnd-kit/sortable for drag-and-drop
   - On drop: PATCH /api/portfolio/reorder with new order array

API routes:
- POST /api/upload/signature — generate Cloudinary signed upload params
- POST /api/portfolio — save uploaded media record to ProfileMedia
- DELETE /api/portfolio/[id] — delete media (also delete from Cloudinary)
- PATCH /api/portfolio/reorder — update order field on multiple records

Set up Cloudinary:
- Create src/lib/cloudinary.ts with the SDK config
- Use signed uploads (never expose API secret client-side)
- Auto-generate thumbnails and responsive sizes
- Store publicId so we can delete later
```

---

## Step 5 — Listings tab (Camera Shop)

**Prompt:**

```
Read the DashboardScreen listings tab in my design file.

Create src/app/(dashboard)/listings/page.tsx:

Access control: only CAMERA_SHOP role. Others see a message explaining
this feature requires the Camera Shop role, with an upgrade link.

1. Header:
   - SectionHead: "Listings" with action button "Add product"
   - Filter row: All | For sale | For rent | Out of stock

2. Product list (Card padding={false}):
   Each row (flex items-center gap-4, px-5 py-4, border-b border-subtle):
   - Thumbnail: 64px wide container, MediaPlaceholder or Image
     (48px height, rounded-lg)
   - Middle (flex-1):
     - Name: text-heading-sm
     - Stock info: text-body-sm, text-secondary
       e.g., "2 in stock" or "Booked till 18 Mar"
   - Badge: "Rental" (accent tone) or "For sale" (neutral tone)
   - Price: text-body-md, font-semibold
     e.g., "$1,899.00" or "$45.00/day"
   - Actions: Edit button (ghost, sm) + dropdown (Duplicate, Delete)

3. Add/Edit product modal or page:
   src/app/(dashboard)/listings/new/page.tsx and [id]/edit/page.tsx

   Form fields:
   - Name (input)
   - Description (textarea)
   - Category (select): Camera body, Lens, Lighting, Audio, Support,
     Accessory, Other
   - Type (radio): For sale | For rent | Both
   - Sale price (input, number) — shown if type includes sale
   - Rental price per day (input, number) — shown if type includes rent
   - Condition (select): New, Like new, Good, Fair
   - Stock quantity (input, number)
   - Images: multi-upload with drag-to-reorder (reuse the upload component
     from Portfolio)
   - Active toggle (Switch)

   Buttons: "Save product" (accent) + "Cancel" (ghost)

4. Empty state:
   - ShoppingBag icon
   - "No products listed"
   - "Add your first camera, lens, or accessory."
   - Button: "Add product"

API routes:
- GET /api/products?shopId=&type= — list products
- POST /api/products — create (requireRole CAMERA_SHOP)
- PATCH /api/products/[id] — update (verify ownership)
- DELETE /api/products/[id] — soft delete (set deletedAt)
```

---

## Step 6 — Settings tab

**Prompt:**

```
Create the settings section with sub-pages:

1. src/app/(dashboard)/settings/layout.tsx:
   - Secondary nav (horizontal tabs or vertical sub-sidebar):
     Profile | Account | Roles | Billing | Notifications
   - {children} below

2. src/app/(dashboard)/settings/profile/page.tsx:
   Form matching the profile fields for the user's roles:
   - Cover image upload (wide, 3:1 ratio preview)
   - Avatar upload (circular preview, 104px)
   - Display name (input)
   - Username (input, with availability check)
   - Bio (textarea, 500 char limit with counter)
   - Location: city (select) + address (input, for STUDIO role)
   - Categories (multi-select chips using Tag component)
   - Price range: min + max (two number inputs)
   - Social links: website, instagram, facebook, tiktok
   - For STUDIO role: area (sqm), amenities (checkbox grid)
   - For CAMERA_SHOP role: shop name
   - Save button (accent, sticky at bottom)

3. src/app/(dashboard)/settings/account/page.tsx:
   - Email (input, with "verify" flow if changed)
   - Change password section (current, new, confirm)
   - Phone number
   - Language preference (EN/VI select)
   - Theme preference (Light/Dark/System select)
   - Danger zone: Delete account (with confirmation modal)

4. src/app/(dashboard)/settings/roles/page.tsx:
   - Show current roles as cards with active/inactive status
   - Each card: role name, icon, status badge, monthly price,
     "Manage" or "Activate" button
   - "Add a role" section with the remaining available roles
   - Note about CUSTOMER role being always free

5. src/app/(dashboard)/settings/notifications/page.tsx:
   - Toggle switches grouped by category:
     Bookings: new request, confirmed, cancelled, reminder
     Messages: new message
     Social: new follower, new review
     Marketing: product updates, tips
   - Each with email + in-app columns

API routes:
- GET/PATCH /api/users/me — user account data
- GET/PATCH /api/profiles/[role] — role-specific profile data
- POST /api/users/me/password — change password
- DELETE /api/users/me — delete account (soft delete)
```

---

## Step 7 — Test & commit

**Prompt:**

```
Run the full test suite:
1. pnpm build
2. pnpm lint
3. pnpm dev

Verify manually with seeded accounts:

As photographer@test.com:
- Dashboard shows provider stats
- Sidebar shows: Overview, Bookings, Portfolio, Messages, Settings
  (NO Listings since not a Camera Shop)
- Bookings tab shows the table with seeded bookings
- Can accept/decline a pending booking
- Portfolio tab: can upload an image, it appears in the grid
- Portfolio: can delete an image
- Settings: can edit profile, changes persist

As shop@test.com:
- Sidebar shows Listings
- Can add a product with images
- Product appears in the listings table

As customer@test.com:
- Sidebar shows only: Overview, Bookings, Messages, Settings
- No Portfolio, no Listings
- Bookings tab shows "My bookings" with customer view
- Trying to access /dashboard/portfolio directly → shows upsell message

General:
- Dark mode works on all dashboard pages
- Responsive: sidebar becomes Sheet below 1024px
- All stats load correctly
- No console errors

Report any issues.
```

**Git commit:**

```bash
git add .
git commit -m "feat(dashboard): Phase 3 — sidebar, stats, bookings, portfolio, listings, settings"
```

---

## Checklist hoàn thành Phase 3

- [ ] Dashboard layout với sidebar 232px sticky
- [ ] Sidebar hiển thị items theo role
- [ ] Plan card ở cuối sidebar
- [ ] Dashboard home với 4 stats cards + greeting
- [ ] Bookings tab: table + accept/decline actions
- [ ] Portfolio tab: grid + upload modal + Cloudinary
- [ ] Listings tab: product CRUD (Camera Shop only)
- [ ] Settings: profile, account, roles, notifications
- [ ] Tất cả API routes có auth + role check
- [ ] Responsive + dark mode

**→ Tiếp theo:** Phase 4 — Public profiles
