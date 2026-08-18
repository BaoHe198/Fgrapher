# Phase 7 — Subscription & Payments

**Thời gian:** ~2 tuần
**Design file:** `SubscriptionScreen.jsx`
**Kết quả:** Stripe subscriptions cho 5 paid roles, billing management, access control theo subscription status.

---

## Step 1 — Stripe setup

**Prompt:**

```
Set up Stripe integration:

1. Install: pnpm add stripe @stripe/stripe-js

2. Create src/lib/stripe.ts:
   - Server-side Stripe client singleton
   - apiVersion: '2024-11-20.acacia' (or latest)
   - Export helper functions:
     getOrCreateCustomer(userId, email, name)
     createCheckoutSession(customerId, priceId, metadata)
     createPortalSession(customerId, returnUrl)
     cancelSubscription(subscriptionId, immediately)

3. Create the products and prices in Stripe.
   Write a setup script scripts/stripe-setup.ts that creates:

   Product: "Fgrapher — Photographer"
     Price: monthly recurring, amount from env
   Product: "Fgrapher — Videographer"
     Price: monthly recurring
   Product: "Fgrapher — Make-up Artist"
     Price: monthly recurring
   Product: "Fgrapher — Studio"
     Price: monthly recurring
   Product: "Fgrapher — Camera Shop"
     Price: monthly recurring

   Each with a 14-day trial period.
   Print the price IDs so I can add them to .env.local.

4. Add to .env.local (I'll fill in the values):
   STRIPE_SECRET_KEY=
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
   STRIPE_WEBHOOK_SECRET=
   STRIPE_PRICE_PHOTOGRAPHER=
   STRIPE_PRICE_VIDEOGRAPHER=
   STRIPE_PRICE_MAKEUP_ARTIST=
   STRIPE_PRICE_STUDIO=
   STRIPE_PRICE_CAMERA_SHOP=

5. Create src/lib/constants/plans.ts mapping roles to prices:
   export const ROLE_PLANS = {
     PHOTOGRAPHER: { priceId: env.STRIPE_PRICE_PHOTOGRAPHER,
                     name: 'Photographer', monthly: 19, currency: 'USD' },
     ...
   }
```

---

## Step 2 — Pricing page

**Prompt:**

```
Read the SubscriptionScreen component in my design file.

Create src/app/(public)/pricing/page.tsx matching the design EXACTLY:

1. Hero section:
   - bg-green-900, text-gold-50, py-20, text-center
   - Eyebrow: text-caption-upper, tracking-[0.14em], text-gold-300
     — "PRICING"
   - H1: text-display-xl — "Plans that grow with your craft"
   - Subtitle: text-body-lg, text-green-200, max-w-[560px] mx-auto
   - Billing toggle: Monthly | Yearly (save 20%)
     Pill toggle matching my design's LangToggle style

2. Free tier callout (a wide card above the paid plans):
   - bg-surface-card, rounded-lg, shadow-sm, p-6
   - flex justify-between items-center
   - Left: "Customer — Free forever" (text-heading-lg) +
     "Browse, book, and buy. No card required." (text-body-md,
     text-secondary)
   - Right: Button secondary — "Sign up free"

3. Paid plans grid: grid grid-cols-5 gap-4 (responsive: 3 → 2 → 1)
   Each plan card:
   - bg-surface-card, rounded-[var(--radius-lg)], shadow-sm, p-6
   - flex flex-col gap-4
   - Popular plan (Photographer): border-2 border-gold-400,
     with a "Most popular" badge at top (accent)

   Card content:
   - Icon (48px circle, bg-success-bg, brand-primary icon)
   - Plan name: text-heading-lg
   - Price: text-display-md + "/month" (text-body-sm, text-secondary)
   - Description: text-body-sm, text-secondary
   - Divider
   - Feature list (flex flex-col gap-2.5):
     Each: Check icon (16px, text-success) + text (text-body-sm)
   - Button (accent for popular, secondary for others), full width:
     "Start 14-day trial"

   Features per plan:
   Photographer / Videographer:
     Public profile with portfolio
     Unlimited photo uploads
     Booking calendar & requests
     Client messaging
     Reviews & ratings
     Search visibility
     Analytics dashboard

   Make-up Artist: same but "Unlimited portfolio uploads"

   Studio:
     Studio listing with photos
     Hourly & daily rate booking
     Amenities showcase
     Availability calendar
     Client messaging
     Reviews & ratings

   Camera Shop:
     Shop profile
     Unlimited product listings
     Rental & sale management
     Order management
     Inventory tracking
     Client messaging

4. Comparison table (below the cards, collapsible):
   - Full feature matrix: rows = features, columns = plans
   - Check / dash icons

5. FAQ section:
   - Accordion component (create in ui/ if not exists)
   - Questions:
     Can I have multiple roles?
     What happens after the free trial?
     Can I cancel anytime?
     Do you take a commission on bookings?
     What payment methods do you accept?
     Is there a discount for annual billing?

6. Final CTA:
   - bg-sunken, py-16, text-center
   - "Still deciding?" + "Talk to us" button

Add metadata: title "Pricing — Fgrapher"
```

---

## Step 3 — Checkout flow

**Prompt:**

```
Build the subscription checkout flow:

1. src/app/(dashboard)/onboarding/subscribe/page.tsx:
   Shown right after registration when the user selected paid roles.

   - H1: "Activate your {role} profile"
   - If multiple roles selected: show them all with a combined total
   - Summary card:
     - Each selected role: name + monthly price
     - Divider
     - Total per month
     - Trial note: "Free for 14 days, then ${total}/month"
   - Payment: Button accent lg — "Start free trial"
     → calls POST /api/stripe/checkout
     → redirects to Stripe Checkout
   - "Skip for now" link → dashboard with roles inactive
     (profile hidden, uploads disabled)

2. API route src/app/api/stripe/checkout/route.ts:
   - requireAuth
   - Body: { roles: Role[] }
   - Get or create the Stripe customer for this user
   - Build line_items from ROLE_PLANS for each role
   - Create a Checkout Session:
     mode: 'subscription'
     line_items
     subscription_data: { trial_period_days: 14 }
     success_url: /dashboard?checkout=success
     cancel_url: /dashboard/onboarding/subscribe?checkout=cancelled
     metadata: { userId, roles: roles.join(',') }
     allow_promotion_codes: true
   - Return { url } for the client to redirect to

3. Success handling:
   - /dashboard reads ?checkout=success
   - Shows a success toast: "Welcome to Fgrapher Pro!"
   - Confetti animation (optional, canvas-confetti)
   - Note: the actual activation happens via webhook, so show a
     brief "Setting up your account..." state that polls
     GET /api/users/me until roles are active

4. Adding a role later:
   src/app/(dashboard)/settings/roles/page.tsx (from Phase 3):
   - "Add a role" → same checkout flow but with
     mode: 'subscription' and the existing subscription updated
     (or a separate subscription per role — simpler to start)
```

---

## Step 4 — Webhooks

**Prompt:**

```
Create the Stripe webhook handler — this is critical infrastructure.

src/app/api/webhooks/stripe/route.ts:

1. Verify the signature:
   - Read the raw body (important: use req.text(), not req.json())
   - Verify with stripe.webhooks.constructEvent using STRIPE_WEBHOOK_SECRET
   - Return 400 on verification failure

2. Handle these events:

   checkout.session.completed:
   - Read metadata: userId, roles
   - Fetch the subscription from Stripe
   - For each role: find or create the UserRole record, set active: true
   - Create a Subscription record with:
     stripeCustomerId, stripeSubscriptionId, stripePriceId,
     status: TRIALING or ACTIVE, currentPeriodStart, currentPeriodEnd
   - Send a welcome email
   - Create a notification

   customer.subscription.updated:
   - Update the Subscription record: status, currentPeriodEnd,
     cancelAtPeriodEnd
   - If status changed to active from past_due: reactivate the role
   - If cancelAtPeriodEnd set: send a "we're sorry to see you go" email

   invoice.paid:
   - Update Subscription: status ACTIVE, extend currentPeriodEnd
   - Create a Payment record for the receipt history
   - Send a receipt email

   invoice.payment_failed:
   - Update Subscription: status PAST_DUE
   - Send a dunning email with a link to update the payment method
   - Start the 7-day grace period (store graceEndsAt)
   - After 3 failed attempts, Stripe will cancel automatically

   customer.subscription.deleted:
   - Update Subscription: status CANCELLED
   - Set UserRole.active = false for the affected roles
   - Set Profile.isPublished = false (hide from search)
   - Send a "your subscription ended" email with a reactivate link
   - Keep all data — user can reactivate anytime

3. Idempotency:
   - Store processed event IDs in a WebhookEvent table
   - Skip if already processed (Stripe may retry)

4. Error handling:
   - Log all errors to Sentry with the event payload
   - Return 200 even on internal errors (so Stripe doesn't retry
     infinitely) but alert on failure

5. Add the WebhookEvent model to Prisma schema:
   model WebhookEvent {
     id        String   @id
     type      String
     processed Boolean  @default(false)
     payload   Json
     error     String?
     createdAt DateTime @default(now())
   }

Local testing:
- Install Stripe CLI
- Run: stripe listen --forward-to localhost:3000/api/webhooks/stripe
- Copy the webhook secret it prints into .env.local
- Trigger test events: stripe trigger checkout.session.completed
```

---

## Step 5 — Billing management

**Prompt:**

```
Build the billing settings page:

src/app/(dashboard)/settings/billing/page.tsx:

1. Current plan section (Card):
   - For each active paid role:
     - Role name + icon
     - Status badge: Active (success) / Trialing (accent) /
       Past due (warning) / Cancelled (danger)
     - Monthly price
     - Next billing date: "Renews on 14 April 2026"
     - If trialing: "Trial ends in 8 days"
     - If cancelAtPeriodEnd: "Cancels on 14 April 2026" +
       "Resume subscription" button
   - Total monthly cost

2. Payment method section:
   - Current card: brand icon + "•••• 4242" + expiry
   - "Update payment method" button → Stripe Customer Portal

3. Billing history:
   - Table: Date | Description | Amount | Status | Invoice
   - Invoice column: download link to the Stripe hosted invoice PDF
   - Fetch from GET /api/stripe/invoices

4. Actions:
   - "Manage subscription" button → Stripe Customer Portal
     (handles: update payment, change plan, cancel, view invoices)
   - "Cancel subscription" → confirmation modal explaining:
     what they lose, that data is kept, that they can reactivate

5. Past due banner (shown site-wide when status is PAST_DUE):
   - Sticky bar below the nav, bg-warning-bg, text-warning
   - "Your payment failed. Update your payment method to keep
     your profile live. {daysLeft} days remaining."
   - Button: "Update payment"

API routes:
- POST /api/stripe/portal — create a Customer Portal session
  Returns { url }
- GET /api/stripe/invoices — list invoices for the customer
- POST /api/stripe/cancel — cancel at period end
- POST /api/stripe/resume — undo a pending cancellation
```

---

## Step 6 — Access control enforcement

**Prompt:**

```
Enforce subscription-based access control throughout the app:

1. Update src/lib/auth-helpers.ts:

   export async function requireActiveSubscription(
     userId: string, role: Role
   ) {
     if (role === 'CUSTOMER') return true // always free

     const userRole = await db.userRole.findFirst({
       where: { userId, role },
       include: { subscription: true }
     })

     if (!userRole?.subscription) throw new SubscriptionError('No subscription')

     const { status, currentPeriodEnd, graceEndsAt } = userRole.subscription
     const now = new Date()

     if (status === 'ACTIVE' || status === 'TRIALING') return true
     if (status === 'PAST_DUE' && graceEndsAt && graceEndsAt > now) return true

     throw new SubscriptionError('Subscription inactive')
   }

2. Apply to API routes:
   - POST /api/portfolio — requires active paid role
   - POST /api/posts — requires active paid role
   - POST /api/products — requires active CAMERA_SHOP
   - POST /api/services — requires active provider role
   - PATCH /api/profiles — allowed even when inactive (so they can
     still edit, just not be visible)

3. Search visibility:
   - The search query already filters isPublished
   - Add: only include profiles whose UserRole has an active subscription
   - When a subscription lapses, the webhook sets isPublished = false

4. UI enforcement:
   - Create src/components/subscription-gate.tsx:
     Wraps content that requires an active subscription.
     If inactive: shows an upsell card instead of the content.
     Props: role, children, fallbackTitle, fallbackText

   - Use it in:
     Portfolio page → "Activate your subscription to upload"
     Listings page → "Camera Shop subscription required"
     Services section → "Activate to list services"

5. Grace period behavior:
   - PAST_DUE within grace: everything still works, banner shown
   - After grace: profile hidden, uploads blocked, but data kept
   - Bookings already CONFIRMED still honored and visible

6. Reactivation:
   - Inactive users see a prominent "Reactivate" CTA on their dashboard
   - Clicking → checkout flow → webhook reactivates → profile republished
```

---

## Step 7 — Test & commit

**Prompt:**

```
Test the payment system thoroughly with Stripe test mode:

Setup:
1. Run: stripe listen --forward-to localhost:3000/api/webhooks/stripe
2. Use test card 4242 4242 4242 4242, any future expiry, any CVC

Test flows:

New subscription:
- Register as a new provider with Photographer role
- Redirected to /dashboard/onboarding/subscribe
- Click "Start free trial" → Stripe Checkout opens
- Complete with the test card
- Redirected back with success
- Check the database: UserRole.active = true, Subscription created
  with status TRIALING
- Profile appears in search

Failed payment:
- Use test card 4000 0000 0000 0341 (fails after attaching)
- Trigger: stripe trigger invoice.payment_failed
- Check: Subscription status PAST_DUE, dunning email sent
- Verify the past-due banner appears site-wide
- Verify uploads still work during grace period

Cancellation:
- Go to billing settings → Cancel subscription
- Verify cancelAtPeriodEnd = true, still active until period end
- Trigger: stripe trigger customer.subscription.deleted
- Check: UserRole.active = false, Profile.isPublished = false
- Profile no longer in search results
- Upload page shows the upsell gate

Reactivation:
- Click "Reactivate" → checkout → complete
- Verify everything is restored

Multiple roles:
- Add Studio role to an existing Photographer
- Verify both subscriptions exist and both features unlock

Also verify:
- Webhook idempotency: replay the same event, no duplicate records
- Invoice history loads and PDFs download
- Customer Portal opens and works
- Currency displays correctly
- Pricing page renders all plans correctly
- Dark mode on pricing and billing pages

Report any issues.
```

**Git commit:**

```bash
git add .
git commit -m "feat(payments): Phase 7 — Stripe subscriptions, checkout, webhooks, billing, access control"
```

---

## Checklist hoàn thành Phase 7

- [ ] Stripe products + prices được tạo
- [ ] Pricing page khớp design
- [ ] Checkout flow với 14-day trial
- [ ] Webhook handler đầy đủ 5 events
- [ ] Idempotency protection
- [ ] Billing settings page
- [ ] Stripe Customer Portal integration
- [ ] Invoice history
- [ ] Access control theo subscription status
- [ ] Grace period 7 ngày
- [ ] Past-due banner site-wide
- [ ] SubscriptionGate component
- [ ] Profile tự động ẩn khi hết hạn
- [ ] Reactivation flow

**→ Tiếp theo:** Phase 8 — Messaging
