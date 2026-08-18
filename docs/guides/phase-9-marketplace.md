# Phase 9 — Marketplace (Camera Shop)

**Thời gian:** ~2 tuần
**Design file:** `DashboardScreen.jsx` (listings tab) + `WebProfileScreen.jsx` (gear tab)
**Kết quả:** Camera Shop bán/cho thuê thiết bị, có cart, checkout, và order management.

---

## Step 1 — Shop browse page

**Prompt:**

```
Read my design file — the gear tab in WebProfileScreen shows the product
card style, and BrowseScreen shows the filter sidebar pattern.

Create src/app/(public)/shop/page.tsx:

Layout: same structure as the browse page
- max-w-[1240px] mx-auto px-8 pt-8 pb-[72px]
- grid grid-cols-[268px_1fr] gap-8, items-start

FILTER SIDEBAR (src/components/shop/shop-filters.tsx):
Same card styling as the browse filters. Sections:

1. TYPE:
   - Radio: All | For sale | For rent

2. CATEGORY:
   - Checkbox list: Camera body, Lens, Lighting, Audio,
     Support (tripod/gimbal), Drone, Accessory, Other
   - Show counts per category

3. CONDITION:
   - Checkbox: New, Like new, Good, Fair

4. PRICE:
   - Range: two number inputs (min / max)
   - For rentals, this filters the daily rate

5. BRAND (if you store brand):
   - Checkbox list of top brands: Sony, Canon, Nikon, Fujifilm,
     Panasonic, Godox, DJI, Profoto, Manfrotto

6. AVAILABILITY:
   - Checkbox: In stock only
   - For rentals: date range picker "Available on these dates"

7. LOCATION:
   - City select (pickup location)

8. Reset button

RESULTS AREA:
1. Header row:
   - H1: text-display-md — "Camera gear"
   - Subtitle: "{count} items · {sortLabel}"
   - Sort select on the right: Newest | Price low-high |
     Price high-low | Most popular

2. Product grid: grid grid-cols-4 gap-5
   Product card (src/components/cards/product-card.tsx):
   - bg-surface-card, rounded-[var(--radius-md)], shadow-sm,
     overflow-hidden, cursor-pointer
   - hover: shadow-md, transition
   - Image: aspect-[4/3], next/image object-cover
     Badge overlay top-left: "Rental" (accent) or "For sale" (neutral)
     Badge overlay top-right if out of stock: "Out of stock" (danger)
   - Body (p-3.5, flex flex-col gap-1.5):
     - Name: text-heading-sm, line-clamp-2
     - Condition badge (small, neutral)
     - Price: text-body-md, font-semibold
       Sale: "$1,899.00" — Rental: "$45.00/day"
     - Shop row: tiny avatar + shop name (text-body-sm, text-secondary)

3. Empty state + pagination (same pattern as browse)

Responsive: 4 → 3 → 2 → 1 columns
```

---

## Step 2 — Product detail page

**Prompt:**

```
Create src/app/(public)/shop/[productId]/page.tsx:

Server Component, fetch the product with shop info and images.

Layout: max-w-[1240px] mx-auto px-8 py-10
grid grid-cols-[1.1fr_400px] gap-12, items-start

LEFT — Image gallery:
1. Main image: aspect-[4/3], rounded-[var(--radius-lg)],
   overflow-hidden, next/image
   - Click opens a lightbox with zoom
2. Thumbnail strip below: flex gap-2.5, overflow-x-auto
   Each: 80x80px, rounded-[var(--radius-sm)], cursor-pointer
   Active: ring-2 ring-brand-primary
3. Below gallery — Description section:
   - H2: "Description" (text-heading-lg)
   - Body text (text-body-md, whitespace-pre-wrap)
4. Specifications table (if you store specs):
   - Two-column rows: label (text-secondary) | value
5. Shop info card:
   - Avatar + shop name + rating + location
   - "View shop" and "Message" buttons

RIGHT — Purchase sidebar (sticky top-[104px]):
Card: bg-surface-card, rounded-[var(--radius-lg)], shadow-md, p-6

1. Type badges row: "For sale" / "Rental" / both
2. Product name: text-display-sm
3. Condition badge
4. Price block:
   - If sale only: big price (text-display-md)
   - If rental only: "$45.00" + "/day" (text-body-md, text-secondary)
   - If both: tabs to switch between Buy and Rent, price updates

5. If BUY mode:
   - Stock indicator: "2 in stock" (success) or "Out of stock" (danger)
   - Quantity stepper: − [1] +
   - Total: quantity × price
   - Button accent lg full-width: "Add to cart"
   - Button secondary full-width: "Buy now" (skips cart)

6. If RENT mode:
   - Date range picker: pickup date → return date
   - Availability check: shows if the item is free for those dates
   - Rental days calculation: "3 days × $45.00 = $135.00"
   - Deposit note: "Deposit: $200 (refunded on return)"
   - Total with deposit
   - Button accent lg full-width: "Request rental"

7. Trust signals (flex flex-col gap-2, text-body-sm, text-secondary):
   - Shield icon + "Buyer protection"
   - Truck icon + "Ships from {city}" or "Pickup at {address}"
   - RotateCcw icon + "7-day return policy"

8. Below: "Save" (heart) and "Share" buttons

RELATED PRODUCTS section at the bottom:
- SectionHead "More from this shop"
- 4-column grid of ProductCard

Add generateMetadata for SEO with product schema JSON-LD.
```

---

## Step 3 — Cart

**Prompt:**

```
Build the shopping cart:

1. Cart state management:
   - Server-side cart (persisted in the CartItem table) so it
     survives across devices
   - Create src/hooks/use-cart.ts:
     Fetches the cart, provides addItem, updateQuantity, removeItem,
     clearCart. Uses optimistic updates + SWR/React Query for caching.

2. Cart drawer (src/components/cart/cart-drawer.tsx):
   - Sheet sliding from the right, width 420px
   - Triggered by the ShoppingBag icon in WebNav (with item count badge)

   Header: "Your cart ({count})" + close button

   Items list (flex flex-col gap-4, overflow-y-auto):
   Each item:
   - flex gap-3
   - Thumbnail 80x80, rounded
   - Middle (flex-1):
     - Name (text-body-md, font-semibold, line-clamp-2)
     - Type badge: "Rental — 3 days" or "Purchase"
     - Shop name (text-body-sm, text-secondary)
     - For rentals: date range (text-body-sm)
   - Right (flex flex-col items-end gap-2):
     - Price (font-semibold)
     - Quantity stepper (for purchases only)
     - Remove button (X, ghost, small)

   Grouped by shop:
   - Since items may come from multiple shops, group them with
     a shop header row and separate subtotals

   Footer (border-t, p-5, flex flex-col gap-3):
   - Subtotal row
   - Deposits row (for rentals)
   - Note: "Shipping calculated at checkout"
   - Button accent lg full-width: "Checkout"
   - "Continue shopping" ghost link

   Empty state: ShoppingBag icon + "Your cart is empty" +
   "Browse gear" button

3. Full cart page src/app/(public)/cart/page.tsx:
   - Same content but as a full page with a wider layout
   - Left: items list, Right: order summary card (sticky)

API routes:
- GET /api/cart — current user's cart with product details
- POST /api/cart — add item { productId, quantity, type,
  rentalStart?, rentalEnd? }
- PATCH /api/cart/[id] — update quantity
- DELETE /api/cart/[id] — remove item
- Validate on every operation: stock available, rental dates free
```

---

## Step 4 — Checkout & payment

**Prompt:**

```
Build the checkout flow with Stripe:

1. src/app/(public)/checkout/page.tsx:
   Multi-step, similar structure to the booking flow.

   STEP 1 — Delivery method:
   - For purchases: radio — Ship to me | Pick up at shop
   - For rentals: pickup is required, show the shop address + map

   STEP 2 — Shipping details (if shipping):
   - Full name, phone
   - Address line 1, line 2
   - City, district, postal code
   - Delivery notes (optional)
   - Save address checkbox

   STEP 3 — Review:
   - Items grouped by shop
   - Price breakdown:
     Subtotal
     Shipping (per shop)
     Rental deposits
     Platform fee (if any)
     Total
   - Terms checkbox

   STEP 4 — Payment:
   - Stripe Payment Element (embedded, not redirect)
   - Or redirect to Stripe Checkout for simplicity
   - Order summary sidebar sticky on the right throughout

2. Payment implementation with Stripe Connect:

   Since shops receive the money, use Stripe Connect:
   - Each Camera Shop must onboard to Stripe Connect Express
   - Platform takes a fee (e.g., 5%) via application_fee_amount
   - Funds go directly to the shop's Stripe account

   Setup:
   - POST /api/stripe/connect/onboard — creates an Account Link
     for the shop to complete onboarding
   - Shop dashboard shows onboarding status and a "Complete setup"
     button until done
   - Products can't be listed until Connect onboarding is complete

   Checkout:
   - POST /api/orders/checkout
     Creates a PaymentIntent per shop (since funds split by shop)
     with transfer_data.destination = shop's Connect account
     and application_fee_amount = platform fee
   - Or use Stripe Checkout with line items and transfer_data

3. Order creation:
   - On payment success (webhook payment_intent.succeeded):
     Create Order + OrderItem records
     Decrement product stock
     For rentals: create a rental reservation blocking those dates
     Clear the cart
     Send confirmation emails to buyer and shop
     Create notifications

4. Success page src/app/(public)/checkout/success/page.tsx:
   - CheckCircle icon
   - "Order confirmed!"
   - Order number
   - Summary of what was ordered
   - "What happens next" steps
   - Buttons: "View order" + "Continue shopping"
```

---

## Step 5 — Order management

**Prompt:**

```
Build order management for both sides:

1. Customer orders src/app/(dashboard)/orders/page.tsx:
   - Tabs: All | Processing | Shipped | Delivered | Cancelled
   - Order cards (flex flex-col gap-4):
     Each card:
     - Header row: Order #12345 · 14 March 2026 · status badge
     - Items preview: thumbnails + names (max 3, then "+2 more")
     - Total price
     - Actions: "View details" | "Track" | "Return" (if eligible)

2. Order detail src/app/(dashboard)/orders/[id]/page.tsx:
   - Status timeline: Ordered → Confirmed → Shipped → Delivered
     Visual stepper with dates
   - Items list with prices
   - Shipping address
   - Payment summary
   - Shop contact card + "Message shop" button
   - For rentals: pickup/return dates, deposit status,
     "Report an issue" button
   - Invoice download

3. Shop orders src/app/(dashboard)/shop-orders/page.tsx:
   (only for CAMERA_SHOP role)
   - Tabs: New | Processing | Shipped | Completed | Cancelled
   - Table view: Order # | Customer | Items | Total | Date | Status | Action
   - Bulk actions: mark as shipped, print packing slips
   - Each order expandable to show items and shipping details

4. Order status updates (shop side):
   - "Confirm order" → status CONFIRMED, email to customer
   - "Mark as shipped" → modal for tracking number + carrier,
     status SHIPPED, email with tracking
   - "Mark as delivered" → status DELIVERED
   - "Cancel order" → reason modal, triggers refund via Stripe

5. Rental-specific flow:
   - Rental status: Reserved → Picked up → Returned → Deposit refunded
   - Shop marks "Picked up" when the customer collects
   - Shop marks "Returned" and either refunds the full deposit or
     deducts for damage (with a note and photos)
   - Automatic reminder emails: pickup day, return day, overdue

6. Inventory sync:
   - Purchases decrement stock on order confirmation
   - Rentals don't decrement stock but block the date range
   - Low stock alert to the shop when stock <= 1
   - Auto-hide products when stock reaches 0 (configurable)

API routes:
- GET /api/orders?role=customer|shop&status=&page=
- GET /api/orders/[id]
- PATCH /api/orders/[id]/status
- POST /api/orders/[id]/refund
- POST /api/orders/[id]/tracking
```

---

## Step 6 — Shop analytics

**Prompt:**

```
Add a simple analytics view for Camera Shops:

src/app/(dashboard)/shop-analytics/page.tsx:

1. Stats cards row:
   - Revenue this month
   - Orders this month
   - Average order value
   - Active listings

2. Revenue chart:
   - Line or bar chart, last 30 days
   - Use recharts
   - Toggle: 7 days | 30 days | 90 days | 12 months

3. Top products table:
   - Product | Views | Orders | Revenue
   - Sortable columns

4. Recent orders list (last 10)

5. Payout summary:
   - Available balance (from Stripe Connect)
   - Pending balance
   - Next payout date
   - "View payouts" link to the Stripe Express dashboard

API: GET /api/shop/analytics?period=
- Aggregate queries on Order and OrderItem
- Cache for 5 minutes
```

---

## Step 7 — Test & commit

**Prompt:**

```
Test the marketplace end-to-end:

Setup: log in as shop@test.com (Camera Shop role)

Shop side:
- Complete Stripe Connect onboarding (test mode)
- Add a product for sale: name, description, images, price, stock
- Add a product for rent: daily rate, deposit
- Product appears in /shop and on the shop's profile gear tab
- Edit a product, changes reflect immediately
- Set stock to 0 → shows "Out of stock"

Customer side (customer@test.com):
- Browse /shop, filters work (type, category, condition, price)
- Open a product detail page, gallery works
- Add a purchase item to cart, quantity stepper works
- Add a rental item with date range, availability checked
- Cart drawer shows items grouped by shop
- Update quantity, remove item
- Proceed to checkout
- Fill shipping address
- Complete payment with test card 4242 4242 4242 4242
- Success page shows order number
- Order appears in /dashboard/orders with PENDING status
- Confirmation email received

Shop side again:
- New order appears in /dashboard/shop-orders
- Confirm the order → customer gets an email
- Mark as shipped with a tracking number → customer notified
- Stock decremented correctly
- Analytics shows the new revenue

Rental flow:
- Rental order created
- Dates blocked on that product for others
- Shop marks picked up → returned → deposit refunded
- Refund appears in Stripe

Edge cases:
- Two customers buy the last item simultaneously → second fails cleanly
- Rental date overlap → blocked
- Checkout with an item that went out of stock → clear error
- Cancel order → refund issued via Stripe

Report any issues.
```

**Git commit:**

```bash
git add .
git commit -m "feat(marketplace): Phase 9 — shop browse, product detail, cart, checkout, orders"
```

---

## Checklist hoàn thành Phase 9

- [ ] Shop browse page với filters đầy đủ
- [ ] Product detail với gallery + buy/rent modes
- [ ] Cart drawer + full cart page, grouped by shop
- [ ] Multi-step checkout
- [ ] Stripe Connect onboarding cho shops
- [ ] Payment split: shop nhận tiền, platform lấy fee
- [ ] Order creation qua webhook
- [ ] Customer order management + tracking
- [ ] Shop order management + status updates
- [ ] Rental flow: reserve → pickup → return → deposit
- [ ] Inventory sync + low stock alerts
- [ ] Shop analytics dashboard

**→ Tiếp theo:** Phase 10 — Reviews & Ratings
