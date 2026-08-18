# Phase 12 — Admin Panel & Launch

**Thời gian:** ~1-2 tuần
**Kết quả:** Admin panel để quản lý platform, và website live trên production.

---

## Step 1 — Admin role & access

**Prompt:**

```
Set up admin access:

1. Add ADMIN to the Role enum in Prisma schema:
   enum Role {
     PHOTOGRAPHER
     VIDEOGRAPHER
     MAKEUP_ARTIST
     STUDIO
     CAMERA_SHOP
     CUSTOMER
     ADMIN
   }
   Create the migration.

2. ADMIN role rules:
   - Not selectable during registration
   - Assigned manually via database or a seed script
   - No subscription required
   - Grants access to /admin routes

3. Create src/lib/admin.ts:
   export async function requireAdmin() {
     const session = await requireAuth()
     const isAdmin = await db.userRole.findFirst({
       where: { userId: session.user.id, role: 'ADMIN', active: true }
     })
     if (!isAdmin) throw new ForbiddenError('Admin access required')
     return session
   }

4. Update middleware to protect /admin routes

5. Create a script to grant admin:
   scripts/make-admin.ts — takes an email, adds the ADMIN role
   Run: npx tsx scripts/make-admin.ts your@email.com

6. Admin layout src/app/(admin)/layout.tsx:
   - Distinct visual treatment so it's obvious you're in admin
     (e.g., a dark top bar with "ADMIN" label)
   - Sidebar: Overview, Users, Content, Reports, Bookings,
     Payments, Settings
   - Same design tokens but with a more utilitarian, dense layout
```

---

## Step 2 — Admin dashboard

**Prompt:**

```
Create src/app/(admin)/admin/page.tsx — the overview dashboard:

1. Key metrics row (grid grid-cols-4 gap-4):
   - Total users (+ growth % vs last month)
   - Active subscriptions (+ MRR)
   - Bookings this month (+ completion rate)
   - GMV this month (bookings + marketplace)

2. Charts (grid grid-cols-2 gap-6):
   - New signups over time (line chart, 30/90/365 days)
   - Revenue breakdown (stacked bar: subscriptions vs marketplace fees)
   - Bookings by status (donut chart)
   - Users by role (bar chart)
   Use recharts, dynamically imported

3. Health indicators:
   - Failed payments count (link to details)
   - Pending reports count
   - Subscriptions expiring in 7 days
   - Profiles pending review

4. Recent activity feed:
   - New signups, new subscriptions, cancellations,
     large bookings, reports filed
   - Each with timestamp and a link to details

5. Quick actions:
   - Send announcement to all users
   - Export data (CSV)
   - Toggle maintenance mode

API: GET /api/admin/stats?period=
- All aggregate queries in parallel
- Cache for 5 minutes
```

---

## Step 3 — User management

**Prompt:**

```
Create src/app/(admin)/admin/users/page.tsx:

1. Users table:
   - Columns: Avatar+Name | Email | Roles | Subscription | Joined |
     Last active | Status | Actions
   - Search: by name, email, username
   - Filters: role, subscription status, signup date range,
     account status (active/suspended/deleted)
   - Sort: any column
   - Pagination, 50 per page
   - Bulk select for bulk actions

2. User detail src/app/(admin)/admin/users/[id]/page.tsx:
   Tabs: Overview | Roles & Billing | Bookings | Content | Activity

   Overview:
   - Full profile info
   - Verification status
   - Account flags/notes
   - Admin notes field (internal only)

   Roles & Billing:
   - All roles with status
   - Subscription details, Stripe customer link
   - Payment history
   - Actions: grant role, revoke role, comp a subscription,
     issue refund

   Bookings:
   - All bookings as provider and customer
   - Completion rate, cancellation rate

   Content:
   - Posts, portfolio items, products, reviews
   - Quick hide/delete actions

   Activity:
   - Login history with IP
   - Recent actions audit log

3. Admin actions:
   - Suspend account (with reason, duration, notify user)
   - Unsuspend
   - Verify account (adds a verified badge)
   - Impersonate user (log in as them for support —
     log this action prominently)
   - Delete account (soft delete, with confirmation)
   - Send a direct message
   - Reset password (sends a reset email)

4. Audit log:
   Add an AdminAction model:
   model AdminAction {
     id        String   @id @default(cuid())
     adminId   String
     action    String
     targetType String
     targetId  String
     details   Json?
     createdAt DateTime @default(now())
     @@index([adminId, createdAt])
     @@index([targetType, targetId])
     @@map("admin_actions")
   }
   Log every admin action.
```

---

## Step 4 — Content moderation

**Prompt:**

```
Create the moderation tools:

1. src/app/(admin)/admin/reports/page.tsx:
   - Queue of pending reports
   - Filters: type (review/user/message/product), reason, status
   - Sort by: newest, most reported
   - Each report card:
     - Reporter info + reason + description + timestamp
     - Reported content preview (inline)
     - Context: link to the full item
     - Actions: Dismiss | Hide content | Warn user |
       Suspend user | Delete content
     - Resolution note field
   - Bulk dismiss for spam reports

2. src/app/(admin)/admin/content/page.tsx:
   - Tabs: Profiles | Posts | Products | Reviews
   - Grid/table of recent content
   - Filter: flagged only, hidden, reported
   - Quick preview modal
   - Actions: approve, hide, delete, feature

3. Auto-flagging review queue:
   - Content flagged by the automated filters from Phase 10
   - Shows why it was flagged
   - Approve (clears the flag) or take action

4. Featured content:
   - Admin can feature profiles → they appear in the
     landing page featured section
   - Featured products → shop homepage
   - Add isFeatured Boolean to Profile and Product
   - Featured until date (optional)

5. Announcements:
   - Create a site-wide banner announcement
   - Target: all users, or filtered by role
   - Type: info, warning, success
   - Schedule: start and end datetime
   - Dismissible per user
   Add an Announcement model.
```

---

## Step 5 — Financial admin

**Prompt:**

```
Create src/app/(admin)/admin/payments/page.tsx:

1. Revenue overview:
   - MRR with trend
   - Subscription revenue by role
   - Marketplace fee revenue
   - Churn rate and reasons

2. Subscriptions table:
   - User | Role | Plan | Status | Started | Next billing | MRR
   - Filter: status, role, expiring soon
   - Actions: view in Stripe, comp, cancel

3. Failed payments:
   - List of PAST_DUE subscriptions
   - Days in grace period
   - Retry count
   - Actions: send reminder, extend grace, cancel

4. Marketplace transactions:
   - Orders with platform fees
   - Shop payout status
   - Refunds issued
   - Disputes/chargebacks

5. Payouts:
   - Connected accounts status
   - Pending payouts
   - Payout history
   - Link to Stripe Connect dashboard

6. Exports:
   - Revenue report CSV by date range
   - Tax report
   - User list export

All data read from Stripe API + local database records.
Cache Stripe calls aggressively (they're rate-limited).
```

---

## Step 6 — Production deployment

**Prompt:**

```
Prepare and execute production deployment:

1. Environment setup:
   - Create a production Supabase project (separate from dev)
   - Run migrations: npx prisma migrate deploy
   - Set up connection pooling correctly
   - Enable Point-in-Time Recovery on Supabase
   - Set up automated backups

2. Vercel project:
   - Connect the GitHub repository
   - Set all production environment variables:
     DATABASE_URL, DIRECT_URL (production Supabase)
     NEXTAUTH_SECRET (new, strong secret)
     NEXTAUTH_URL (production domain)
     Google OAuth (production credentials with the production
       redirect URI)
     Cloudinary (production or same account, separate folder)
     Stripe LIVE keys (not test)
     STRIPE_WEBHOOK_SECRET (from the production webhook endpoint)
     RESEND_API_KEY (verified domain)
     SENTRY_DSN
     CRON_SECRET
   - Set the production branch to main
   - Enable preview deployments for PRs

3. Domain:
   - Add the custom domain in Vercel
   - Configure DNS (A/CNAME records)
   - Verify SSL is active
   - Set up www → apex redirect (or vice versa)

4. Stripe production:
   - Activate the Stripe account (business verification)
   - Create live mode products and prices
   - Update the price IDs in production env vars
   - Add the production webhook endpoint:
     https://yourdomain.com/api/webhooks/stripe
   - Select the same events as in test mode
   - Copy the signing secret to env

5. Email:
   - Verify the sending domain in Resend
   - Set up SPF, DKIM, DMARC records
   - Test deliverability (mail-tester.com)
   - Set up a support@ inbox

6. Cron jobs (vercel.json):
   {
     "crons": [
       { "path": "/api/cron/booking-reminders", "schedule": "0 9 * * *" },
       { "path": "/api/cron/subscription-check", "schedule": "0 2 * * *" },
       { "path": "/api/cron/rating-recalc", "schedule": "0 3 * * 0" },
       { "path": "/api/cron/cleanup", "schedule": "0 4 * * *" }
     ]
   }

7. Monitoring:
   - Sentry: production project, source maps uploaded
   - Vercel Analytics enabled
   - Uptime monitoring (BetterStack, UptimeRobot)
   - Database monitoring in Supabase
   - Set up alerts: error rate spike, downtime, failed payments

8. Security final check:
   - All secrets in env vars, none in code
   - Rate limiting on all public API routes
   - CORS configured correctly
   - CSP headers in next.config.js
   - Dependency audit: pnpm audit, fix vulnerabilities
   - Verify no debug/test routes are exposed
```

---

## Step 7 — Launch checklist

**Prompt:**

```
Final pre-launch verification. Go through this checklist and
report the status of each item:

LEGAL & COMPLIANCE:
- [ ] Terms of Service page published
- [ ] Privacy Policy published (GDPR + Vietnamese law compliant)
- [ ] Cookie consent banner (if using analytics cookies)
- [ ] Refund/cancellation policy documented
- [ ] Business registration info in the footer if required

CONTENT:
- [ ] Landing page copy final (no lorem ipsum)
- [ ] All email templates reviewed
- [ ] Help/FAQ page with real answers
- [ ] Contact page with a working form
- [ ] About page

FUNCTIONALITY (test on production with real accounts):
- [ ] Registration → email verification → role selection
- [ ] Subscription checkout with a real card (then refund)
- [ ] Profile creation and portfolio upload
- [ ] Search returns results
- [ ] Booking request → accept → complete → review
- [ ] Messaging real-time
- [ ] Marketplace purchase
- [ ] Password reset
- [ ] All emails deliver to Gmail, Outlook, Yahoo

TECHNICAL:
- [ ] SSL certificate valid
- [ ] All pages load under 3s
- [ ] No console errors in production
- [ ] Sentry receiving events
- [ ] Analytics tracking
- [ ] Sitemap accessible and submitted to Google
- [ ] robots.txt correct
- [ ] 404 and 500 pages styled
- [ ] Database backups running
- [ ] Cron jobs executing

BUSINESS:
- [ ] Stripe account fully activated
- [ ] Payout bank account connected
- [ ] Support email monitored
- [ ] Social media accounts created
- [ ] Seed content: at least 20 real or demo profiles so the
      site doesn't look empty

ROLLBACK PLAN:
- [ ] Know how to revert a deployment in Vercel
- [ ] Database backup taken immediately before launch
- [ ] Maintenance mode toggle tested
```

---

## Step 8 — Post-launch

**Prompt:**

```
Set up post-launch operations:

1. Monitoring routine (daily for the first 2 weeks):
   - Check Sentry for new errors
   - Review failed payments
   - Check the moderation queue
   - Monitor signup and activation rates
   - Read support emails

2. Analytics to watch:
   - Signup → profile complete conversion
   - Profile complete → subscription conversion
   - Search → profile view → booking conversion
   - Booking request → confirmation rate
   - Day 7 and Day 30 retention

3. Feedback collection:
   - Add a feedback widget (or a simple form)
   - Reach out to the first 20 providers personally
   - Set up a changelog page

4. Iteration backlog:
   Create a GitHub Projects board with columns:
   Bugs | Quick wins | Features | Nice to have
   Populate from user feedback and analytics

5. Common post-launch fixes to expect:
   - Timezone bugs
   - Email deliverability issues
   - Mobile layout edge cases
   - Search relevance tuning
   - Onboarding friction points

6. Growth features to consider next:
   - Referral program
   - Provider verification badges
   - Instant booking (skip approval)
   - Package deals (photographer + MUA bundle)
   - Mobile app (React Native sharing the API)
   - Provider analytics dashboard
   - Automated invoicing
   - Multi-currency support
```

---

## Checklist hoàn thành Phase 12

- [ ] ADMIN role + protected /admin routes
- [ ] Admin dashboard với metrics + charts
- [ ] User management: search, filter, detail, actions
- [ ] Audit log cho mọi admin action
- [ ] Report queue + moderation tools
- [ ] Featured content management
- [ ] Announcements system
- [ ] Financial admin: subscriptions, failed payments, payouts
- [ ] Production Supabase + migrations
- [ ] Vercel production deployment
- [ ] Custom domain + SSL
- [ ] Stripe live mode + production webhook
- [ ] Email domain verified (SPF/DKIM/DMARC)
- [ ] Cron jobs configured
- [ ] Sentry + analytics + uptime monitoring
- [ ] Legal pages published
- [ ] Full launch checklist passed

---

## 🚀 LAUNCHED

Chúc mừng! Fgrapher đã live. Từ đây tập trung vào:
1. Nghe feedback từ users thật
2. Fix bugs nhanh
3. Đo conversion funnel và tối ưu điểm rơi
4. Thêm features dựa trên nhu cầu thực tế, không phải giả định
