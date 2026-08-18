# Phase 10 — Reviews & Ratings

**Thời gian:** ~1 tuần
**Design file:** `WebProfileScreen.jsx` (reviews tab)
**Kết quả:** Hệ thống đánh giá gắn với booking đã hoàn thành, có provider response và moderation.

---

## Step 1 — Review components

**Prompt:**

```
Read the reviews tab in WebProfileScreen from my design file.

Create the review UI components:

1. src/components/ui/star-input.tsx (interactive rating input):
   - 5 star icons, size configurable (default 32px)
   - Hover: fills stars up to the hovered index (gold-400)
   - Click: sets the rating
   - Unfilled: text-neutral-300
   - Filled: text-gold-400, fill-gold-400
   - Optional label below showing the meaning:
     1 "Poor" · 2 "Fair" · 3 "Good" · 4 "Very good" · 5 "Excellent"
   - Props: value, onChange, size, showLabel

2. src/components/reviews/rating-summary.tsx:
   Card showing the aggregate rating:
   - Left block (flex flex-col items-center gap-1, min-w-[140px]):
     - Big number: text-display-lg (e.g., "4.9")
     - StarRating display (5 stars, size 18)
     - Count: text-body-sm, text-secondary — "128 reviews"
   - Right block (flex-1, flex flex-col gap-2):
     Breakdown bars, one per star level (5 down to 1):
     - flex items-center gap-3
     - Label: "5" + star icon (14px)
     - Track: flex-1, h-2, rounded-full, bg-neutral-200
     - Fill: h-full, rounded-full, bg-gold-400, width = percentage
     - Count: text-body-sm, text-tertiary, min-w-[32px] text-right

3. src/components/reviews/review-item.tsx:
   - flex gap-3
   - Avatar 40px
   - Content block (flex-1, flex flex-col gap-1.5):
     - Row: name (text-heading-sm) + verified badge if from a
       completed booking
     - Row: StarRating (size 14) + date (text-body-sm, text-tertiary)
     - Service tag: "Portrait session" (Tag component, tiny)
     - Review text: text-body-md, text-secondary
       Long reviews: line-clamp-4 with "Read more" toggle
     - Photos (if any): flex gap-2, 72x72px thumbnails,
       rounded, clickable → lightbox
     - Helpful row: "Was this helpful?" + thumbs up count
     - Provider response (if any):
       - mt-3, pl-4, border-l-2 border-brand-primary
       - Header: shop/provider avatar (24px) + name +
         "responded {date}"
       - Text: text-body-md, text-secondary
     - Actions (owner only): Edit | Delete
     - Actions (others): Report

4. src/components/reviews/review-list.tsx:
   - Sort dropdown: Newest | Highest rated | Lowest rated | Most helpful
   - Filter chips: All | 5★ | 4★ | 3★ | 2★ | 1★ | With photos
   - List of ReviewItem with dividers
   - Pagination or "Load more"
   - Empty state per filter
```

---

## Step 2 — Leave a review flow

**Prompt:**

```
Build the review submission flow:

1. Eligibility:
   - Only the customer of a COMPLETED booking can review
   - One review per booking
   - Review window: within 30 days of completion
   - Check server-side on every submission

2. Review prompt entry points:
   a. Booking detail page (status COMPLETED):
      - Prominent card: "How was your session with {name}?"
      - StarInput inline — clicking a star opens the full modal
        with that rating pre-selected
   b. Email: sent 24 hours after booking completion
      - "Rate your experience" CTA linking to
        /review/[bookingId]
   c. Dashboard notification
   d. Orders page for marketplace purchases (product reviews)

3. Review modal (src/components/modals/review-modal.tsx):
   Dialog, max-w-[520px]

   - Header: provider avatar + name + service + date
   - StarInput (large, 40px, with label)
   - Textarea: "Share your experience"
     placeholder "What did you like? What could be better?"
     min 20 chars, max 1000, with counter
   - Photo upload: "Add photos from your session" (optional, max 5)
     Drag-drop zone + thumbnail previews
   - Category ratings (optional, expandable "Rate details"):
     Communication, Punctuality, Quality, Value — each a StarInput
   - Anonymous checkbox: "Post as anonymous" (shows initials only)
   - Buttons: "Submit review" (accent) + "Cancel" (ghost)

   On submit:
   - POST /api/reviews
   - Success: toast + modal closes + review appears on the profile
   - Recalculate the provider's avgRating and reviewCount

4. Standalone review page src/app/(public)/review/[bookingId]/page.tsx:
   - For the email link flow
   - Verifies the token/session, shows the same form full-page
   - After submit: thank-you screen with a link to the profile

5. Edit review:
   - Within 7 days of posting
   - Same modal pre-filled
   - Shows "edited" label after editing
```

---

## Step 3 — Provider response

**Prompt:**

```
Let providers respond to reviews:

1. Response entry point:
   - On the provider's own profile page reviews tab, each review
     without a response shows a "Respond" button
   - Also in the dashboard: /dashboard/reviews page listing all
     reviews with response status

2. Response modal:
   - Shows the original review at the top (read-only)
   - Textarea: "Your response" (max 500 chars)
   - Guidance text: "Thank the reviewer and address any concerns
     professionally. Responses are public."
   - Buttons: "Post response" + "Cancel"
   - One response per review, editable within 24 hours

3. src/app/(dashboard)/reviews/page.tsx:
   - Stats row: average rating, total reviews, response rate,
     reviews awaiting response
   - Tabs: All | Awaiting response | Responded | Reported
   - Review list with inline respond buttons
   - Filter by rating

4. Review notifications:
   - New review → notification + email to provider
   - Provider response → notification + email to reviewer

API:
- POST /api/reviews/[id]/respond
- PATCH /api/reviews/[id]/respond (within 24h)
```

---

## Step 4 — Rating aggregation

**Prompt:**

```
Implement efficient rating aggregation:

1. Add fields to the Profile model:
   avgRating      Float?  @default(0)
   reviewCount    Int     @default(0)
   ratingBreakdown Json?  // { "5": 89, "4": 24, "3": 8, "2": 4, "1": 3 }

   Create a migration.

2. Create src/services/rating.ts:

   export async function recalculateRating(providerId: string) {
     - Aggregate all reviews for this provider
     - Compute average, count, and the breakdown object
     - Update the Profile record
     - Use a transaction
   }

   Call this after: review created, updated, deleted, or hidden.

3. Alternative (better for scale): incremental updates
   - On review create: 
     newAvg = (oldAvg * oldCount + newRating) / (oldCount + 1)
   - On delete: reverse the calculation
   - Periodically run a full recalculation via cron to fix drift

4. Use avgRating in:
   - Search sorting (order by avgRating desc)
   - Search filtering (minRating param)
   - Profile display (no aggregate query needed)
   - ArtistCard display

5. Bayesian average for fairness (optional but recommended):
   Prevents a single 5-star review from outranking a 4.8 with
   200 reviews.

   weightedRating = (v / (v + m)) * R + (m / (v + m)) * C
   where:
     v = number of reviews for this provider
     m = minimum reviews required to be listed (e.g., 5)
     R = average rating for this provider
     C = mean rating across all providers

   Store as a separate field rankingScore, use it for search sorting
   while displaying the raw avgRating to users.
```

---

## Step 5 — Product reviews

**Prompt:**

```
Extend reviews to marketplace products:

1. Add a ProductReview model to Prisma:
   model ProductReview {
     id         String   @id @default(cuid())
     orderItemId String  @unique
     productId  String
     reviewerId String
     rating     Int
     content    String?  @db.Text
     images     String[]
     response   String?  @db.Text
     respondedAt DateTime?
     helpful    Int      @default(0)
     createdAt  DateTime @default(now())
     updatedAt  DateTime @updatedAt
     
     product  Product @relation(fields: [productId], references: [id])
     reviewer User    @relation(fields: [reviewerId], references: [id])
     @@index([productId, rating])
     @@map("product_reviews")
   }

   Add avgRating and reviewCount to the Product model.

2. Eligibility: only buyers of a DELIVERED order can review

3. Product detail page: add a reviews section below the description
   - RatingSummary component
   - ReviewList component
   - "Write a review" button if eligible

4. Shop owner can respond to product reviews

5. Reviews influence shop search ranking and product sorting
```

---

## Step 6 — Moderation

**Prompt:**

```
Add review moderation:

1. Report review:
   - Report button on each review
   - Modal: reason select (Spam, Fake, Offensive, Off-topic,
     Personal information, Other) + description
   - Creates a Report record

2. Add the Report model:
   model Report {
     id          String   @id @default(cuid())
     reporterId  String
     targetType  String   // 'review' | 'user' | 'message' | 'product'
     targetId    String
     reason      String
     description String?  @db.Text
     status      ReportStatus @default(PENDING)
     reviewedBy  String?
     reviewNote  String?
     createdAt   DateTime @default(now())
     resolvedAt  DateTime?
     @@index([status, createdAt])
     @@map("reports")
   }

   enum ReportStatus { PENDING REVIEWING RESOLVED DISMISSED }

3. Auto-moderation on submission:
   - Profanity filter (basic word list, EN + VI)
   - Detect contact info (phone, email) → flag for review
   - Detect all-caps spam
   - Very short reviews with low ratings → flag
   - Flagged reviews are published but marked for admin review

4. Add moderation fields to Review:
   isHidden    Boolean @default(false)
   hiddenReason String?
   flagged     Boolean @default(false)

5. Hidden reviews:
   - Not shown publicly
   - Not counted in the aggregate rating
   - Reviewer sees "Under review" status on their own review

6. Anti-gaming measures:
   - Reviews only from verified completed bookings (already enforced)
   - Rate limit: max 5 reviews per user per day
   - Flag if reviewer and provider have an unusual pattern
     (e.g., many mutual bookings in a short time)
   - Providers cannot review themselves or their alternate accounts
     (check IP / payment method overlap for admin review)
```

---

## Step 7 — Test & commit

**Prompt:**

```
Test the review system:

Setup: create a COMPLETED booking between customer@test.com
and photographer@test.com (update the status directly in the
database or via the API).

Test:
- Customer sees "How was your session?" prompt on the booking detail
- Clicking a star opens the review modal with that rating selected
- Submit with rating + text + 2 photos
- Review appears on the photographer's profile reviews tab
- Rating summary updates: average, count, breakdown bars
- ArtistCard on browse now shows the updated rating
- Try to review the same booking again → blocked
- Edit the review within 7 days → works, shows "edited"
- Photographer sees the review in /dashboard/reviews
- Photographer responds → response appears indented under the review
- Reviewer gets a notification + email about the response
- Sort reviews by Highest / Lowest / Newest → order changes
- Filter by 5★ → only 5-star reviews show
- Report a review → Report record created
- Hide a review (as admin) → disappears from public view,
  rating recalculates
- Product review: buy a product, mark order DELIVERED,
  leave a product review → appears on the product page
- Rate limit: try 6 reviews in a day → blocked

Verify aggregation:
- Add several reviews with different ratings
- Check that avgRating, reviewCount, and ratingBreakdown are correct
- Check that search sorting by rating uses the right order

Report any issues.
```

**Git commit:**

```bash
git add .
git commit -m "feat(reviews): Phase 10 — review system, ratings, responses, moderation"
```

---

## Checklist hoàn thành Phase 10

- [ ] StarInput component (interactive)
- [ ] RatingSummary với breakdown bars
- [ ] ReviewItem với provider response
- [ ] Review modal với photos + category ratings
- [ ] Eligibility check (chỉ COMPLETED booking)
- [ ] Standalone review page cho email link
- [ ] Provider response flow
- [ ] Dashboard reviews page với stats
- [ ] Rating aggregation (avgRating, reviewCount, breakdown)
- [ ] Bayesian ranking score cho search
- [ ] Product reviews cho marketplace
- [ ] Report + moderation + auto-flagging
- [ ] Anti-gaming measures

**→ Tiếp theo:** Phase 11 — Polish & Optimization
