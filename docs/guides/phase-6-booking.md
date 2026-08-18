# Phase 6 — Booking Flow

**Thời gian:** ~2 tuần
**Design file:** `BookingFlowScreen.jsx` + booking sidebar từ `WebProfileScreen.jsx`
**Kết quả:** Luồng đặt lịch hoàn chỉnh từ chọn service → chọn ngày giờ → xác nhận → thông báo.

---

## Step 1 — Booking flow page

**Prompt:**

```
Read the BookingFlowScreen component in my design file.

Create src/app/(public)/booking/[providerId]/page.tsx — a multi-step
booking flow:

Layout:
- max-w-[900px] mx-auto px-8 py-10
- Progress indicator at top:
  - 4 steps: Service → Date & time → Details → Confirm
  - Each step: circle with number (or check icon when done) + label
  - Connecting lines between circles
  - Active step: bg-brand-primary, text-on-brand
  - Completed: bg-success, check icon
  - Upcoming: bg-neutral-200, text-tertiary
  - Line between: bg-brand-primary if passed, bg-neutral-200 if not

- Content area: Card with p-8
- Navigation buttons at bottom: "Back" (ghost) + "Continue" (accent)

STEP 1 — Select service:
- H2: "What do you need?"
- List of the provider's active services (flex flex-col gap-3):
  Each as a selectable card:
  - p-5, rounded-[var(--radius-md)], cursor-pointer
  - Unselected: border border-default, bg-surface
  - Selected: border-brand-primary, bg-success-bg, ring-1 ring-brand-primary
  - Content: flex justify-between items-start
    Left: name (text-heading-sm), description (text-body-sm, text-secondary),
          duration chip (Clock icon + "2 hours")
    Right: price (text-heading-sm)
- If provider has no services: "Custom request" option with a
  free-text field

STEP 2 — Pick date & time:
- H2: "When works for you?"
- Two-column layout: grid grid-cols-[1fr_280px] gap-8
  Left: full month calendar
    - Month navigation header
    - 7-column day grid
    - Available days: clickable, hover bg-sunken
    - Selected: bg-brand-primary, text-on-brand
    - Unavailable: text-tertiary, opacity-40, cursor-not-allowed
    - Days with limited availability: small dot indicator
    - Past dates: disabled
  Right: time slots panel
    - Shows after a date is selected
    - Label: selected date formatted "Saturday, 14 March"
    - Slot buttons in a vertical list
    - Selected slot highlighted
    - "No availability" message if empty
- Timezone note below: "Times shown in {userTimezone}"

STEP 3 — Add details:
- H2: "Tell {firstName} about your shoot"
- Fields:
  - Location type (radio): At provider's studio | At my location |
    Outdoor / other
  - Address input (if "At my location" or "Outdoor")
  - Number of people (number input)
  - Notes (textarea, 1000 chars): "Describe your vision, style
    references, special requirements..."
  - Reference images upload (optional, max 5)
  - Contact phone (input, pre-filled from profile)

STEP 4 — Review & confirm:
- H2: "Review your booking"
- Summary card:
  - Provider block: avatar + name + role + rating
  - Divider
  - Rows (flex justify-between, py-2.5):
    Service, Date, Time, Duration, Location, People
  - Divider
  - Price breakdown:
    Service price
    Platform fee (if applicable)
    Total (font-bold, text-heading-md)
  - Notes preview
- Cancellation policy box (bg-sunken, p-4, rounded, text-body-sm)
- Checkbox: "I agree to the booking terms"
- Button accent lg full-width: "Send booking request"

After submit:
- Success page or modal:
  - CheckCircle icon (success color, 64px)
  - H2: "Booking request sent!"
  - Text: "{provider} will respond within 24 hours. We'll email you
    as soon as they confirm."
  - Buttons: "View my bookings" (accent) + "Browse more artists" (ghost)

State management:
- Use a single useState object or useReducer for the booking draft
- Persist to sessionStorage so a refresh doesn't lose progress
- Pre-fill from URL params if coming from the profile sidebar
  (?service=&date=&time=)
- Validate each step before allowing "Continue"
```

---

## Step 2 — Availability engine

**Prompt:**

```
Build the availability calculation logic — this is the core of booking.

Create src/services/availability.ts:

export async function getAvailability(
  providerId: string,
  from: Date,
  to: Date,
  serviceDurationMinutes?: number
): Promise<AvailabilityResult>

Logic:
1. Fetch the provider's weekly Availability records
   (dayOfWeek, startTime, endTime, isActive)

2. Fetch BlockedDate records in the range

3. Fetch existing bookings with status CONFIRMED or PENDING
   in the range

4. For each date in [from, to]:
   a. Find the matching weekly availability for that day-of-week
   b. If none or inactive → date unavailable
   c. If the date is in BlockedDate → unavailable
   d. Generate time slots from startTime to endTime, stepping by
      the provider's slot duration (default 60 min)
   e. Remove slots that overlap with existing bookings
      (account for service duration + buffer time)
   f. Remove slots in the past (if the date is today)
   g. Apply minimum notice period (e.g., can't book within 24 hours)

5. Return:
   {
     dates: [{
       date: '2026-03-14',
       available: boolean,
       slotsAvailable: number,
       slots: [{ time: '14:00', available: boolean }]
     }]
   }

Handle timezone carefully:
- Store all times in the database in the provider's local timezone
  (add a timezone field to the User model)
- Convert to the viewer's timezone for display
- Use date-fns-tz for conversions

Create the API route src/app/api/availability/[providerId]/route.ts:
- GET with query params: from, to, serviceId
- Cache the response for 60 seconds
- Return the availability result

Also create:
- PUT /api/availability — provider updates their weekly schedule
- POST /api/blocked-dates — block a date
- DELETE /api/blocked-dates/[id] — unblock
```

---

## Step 3 — Booking API & state machine

**Prompt:**

```
Create the booking API with a proper state machine:

Valid status transitions:
PENDING → CONFIRMED (provider accepts)
PENDING → DECLINED (provider declines)
PENDING → CANCELLED (customer cancels before response)
CONFIRMED → COMPLETED (provider marks done, after the date)
CONFIRMED → CANCELLED (either party cancels)
CONFIRMED → NO_SHOW (provider reports, after the date)

Create src/services/booking.ts with:

export async function createBooking(data: CreateBookingInput)
- Validate the slot is still available (race condition check)
- Use a database transaction
- Create the Booking record with status PENDING
- Create a Notification for the provider
- Send email to the provider
- Return the booking

export async function updateBookingStatus(
  bookingId: string,
  newStatus: BookingStatus,
  userId: string,
  reason?: string
)
- Verify the user is a participant
- Verify the transition is valid for this user's role:
  Only provider can: CONFIRMED, DECLINED, COMPLETED, NO_SHOW
  Both can: CANCELLED
- Check timing rules:
  Can't cancel within 24h of the booking (or apply a fee)
  Can't mark COMPLETED before the booking date
- Update the record
- Create notification for the other party
- Send email
- If CONFIRMED: block that time slot from further bookings

API routes:
- POST /api/bookings — create
- GET /api/bookings?status=&role=provider|customer&page=
- GET /api/bookings/[id] — single booking detail
- PATCH /api/bookings/[id] — status update
  Body: { status, reason? }
- POST /api/bookings/[id]/reschedule — propose a new date/time
  (creates a pending change request the other party must approve)

All routes: requireAuth, verify participation, validate with zod.
```

---

## Step 4 — Notifications & emails

**Prompt:**

```
Build the notification system:

1. Create src/services/notification.ts:
   export async function notify({
     userId, type, title, message, data
   }: NotifyInput)
   - Create a Notification record in the database
   - Emit a real-time event (prepare for Socket.io in Phase 8)
   - Send an email if the user's preferences allow it

2. Email templates in src/emails/ (use react-email):
   - booking-request.tsx — to provider: "New booking request from {name}"
   - booking-confirmed.tsx — to customer: "{provider} confirmed your booking"
   - booking-declined.tsx — to customer, with a suggestion to browse others
   - booking-cancelled.tsx — to the other party
   - booking-reminder.tsx — 24 hours before, to both parties
   - booking-completed.tsx — to customer, with a review request

   All templates:
   - Header: green-900 background with the Fgrapher logo
   - Body: white, text-primary
   - CTA button: gold-400 background
   - Footer: links + unsubscribe
   - Match the brand colors from my design

3. Notification bell in WebNav:
   - Badge with unread count
   - Dropdown panel showing recent notifications
   - Each: icon by type, title, message, relative time
   - Click marks as read and navigates to the relevant page
   - "Mark all as read" action
   - "View all" → /dashboard/notifications

4. src/app/(dashboard)/notifications/page.tsx:
   - Full list, paginated
   - Filter tabs: All | Unread | Bookings | Messages | Social

5. Scheduled reminders:
   - Create an API route /api/cron/booking-reminders
   - Finds bookings 24 hours out with status CONFIRMED
   - Sends reminder emails
   - Set up as a Vercel Cron job (vercel.json):
     { "crons": [{ "path": "/api/cron/booking-reminders",
                   "schedule": "0 9 * * *" }] }
   - Protect the route with a CRON_SECRET header check

API routes:
- GET /api/notifications?unread=&page=
- PATCH /api/notifications/[id]/read
- POST /api/notifications/read-all
```

---

## Step 5 — Booking management UI

**Prompt:**

```
Enhance the bookings pages from Phase 3 with full functionality:

1. Booking detail page src/app/(dashboard)/bookings/[id]/page.tsx:
   - Header: status badge + booking ID + created date
   - Two-column: details (left) + actions sidebar (right)

   Details:
   - Participant card (the other party): avatar, name, role, rating,
     "View profile" and "Message" buttons
   - Service details: name, description, duration, price
   - Schedule: date, time, timezone
   - Location: type + address, with a map preview if applicable
   - Customer notes
   - Reference images gallery
   - Timeline: status change history with timestamps

   Actions sidebar (sticky):
   - Status-appropriate buttons:
     PENDING (provider): Accept | Decline | Propose new time
     PENDING (customer): Cancel request
     CONFIRMED (both): Message | Reschedule | Cancel
     CONFIRMED (provider, past date): Mark completed | Report no-show
     COMPLETED (customer): Leave a review
   - Price summary
   - Cancellation policy reminder

2. Accept flow (provider):
   - Confirmation modal: "Confirm this booking?"
   - Shows the details summary
   - Optional message to the customer
   - Confirms → status CONFIRMED, email sent

3. Decline flow:
   - Modal with reason select: Unavailable | Outside my service area |
     Not my specialty | Other
   - Optional message
   - Suggestion: "Recommend another artist?" (optional)

4. Reschedule flow:
   - Opens the calendar picker
   - Selecting a new slot sends a proposal
   - Other party gets a notification with Accept / Decline options

5. Cancel flow:
   - Warning about the cancellation policy
   - Reason input
   - If within 24h: warn about potential fee
   - Confirm → status CANCELLED

6. Calendar view (provider):
   src/app/(dashboard)/calendar/page.tsx
   - Month view showing all bookings as events
   - Color-coded by status
   - Click event → booking detail
   - Toggle: Month | Week | Agenda list
   - Use react-big-calendar or build a custom month grid
```

---

## Step 6 — Test & commit

**Prompt:**

```
Run the full test:
1. pnpm build
2. pnpm lint
3. pnpm dev

Test the complete booking flow end-to-end:

As customer@test.com:
- Browse → open a photographer profile
- Click "Book" on a service
- Step 1: service is pre-selected
- Step 2: calendar shows availability, busy days grayed
- Select a date → time slots load
- Select a time → Continue enabled
- Step 3: fill in location, notes, phone
- Step 4: review shows correct summary and total
- Submit → success screen
- Check /dashboard/bookings → new booking with PENDING status
- Check email inbox (or Resend logs) → provider got the email

As photographer@test.com:
- Notification bell shows unread badge
- /dashboard/bookings shows the pending request
- Open booking detail
- Click Accept → confirmation modal → confirm
- Status changes to CONFIRMED
- Customer gets email

Edge cases to verify:
- Two customers try to book the same slot → second one gets an error
- Cannot book a date in the past
- Cannot book within the minimum notice period
- Provider blocks a date → it disappears from the calendar
- Cancelling within 24h shows the policy warning
- Reschedule proposal flow works both directions
- Timezone: booking made in one timezone displays correctly in another

Report any issues.
```

**Git commit:**

```bash
git add .
git commit -m "feat(booking): Phase 6 — multi-step booking flow, availability engine, notifications"
```

---

## Checklist hoàn thành Phase 6

- [ ] Multi-step booking flow (4 bước) với progress indicator
- [ ] Calendar tháng với availability chính xác
- [ ] Availability engine: weekly schedule − blocked dates − existing bookings
- [ ] Timezone handling
- [ ] Booking state machine với validation transitions
- [ ] Race condition protection (transaction)
- [ ] Email templates (6 loại) theo brand
- [ ] Notification bell + dropdown + trang notifications
- [ ] Cron job gửi reminder
- [ ] Booking detail page với actions theo status
- [ ] Accept / Decline / Reschedule / Cancel flows
- [ ] Calendar view cho provider

**→ Tiếp theo:** Phase 7 — Subscription & Payments
