# Fgrapher — Prompts đợt tiếp theo

Copy từng khối vào Claude Code, làm xong một cái rồi mới sang cái tiếp theo.

---

## 1. Gộp "Sign in" và "Get started" thành một button

```
Right now the navigation has two separate buttons for logged-out users:
"Sign in" (ghost) and "Get started" (accent). Merge them into a single
entry point.

Changes:

1. In src/components/layout/web-nav.tsx, replace the two buttons with
   one button labelled "Đăng nhập / Đăng ký" (Vietnamese) or
   "Sign in / Sign up" (English). Use the accent variant, sm size.
   It links to /login.

2. Do the same in the mobile Sheet menu — one button, full width,
   accent variant, placed at the bottom of the menu.

3. Turn /login into a combined auth page with a tab switcher at the top
   of the form column:
   - Two tabs: "Đăng nhập" | "Đăng ký"
   - Tab styling matches my existing Tabs component: active tab has
     text-primary with a border-b-2 border-brand-primary, inactive is
     text-secondary
   - Switching tabs swaps the form without a page navigation, so the
     AuthShell visual column on the right stays mounted and doesn't
     flash
   - The active tab syncs to a URL query param (?mode=register) so the
     state survives a refresh and can be linked to directly
   - Keep /register as a working route that redirects to
     /login?mode=register so existing links and the pricing page CTAs
     (/register?role=PHOTOGRAPHER) keep working — carry the role param
     through the redirect

4. Preserve everything that already works:
   - The role picker (Customer vs Creative pro + role checkboxes) still
     appears in the register tab
   - callbackUrl is preserved across the tab switch
   - Social buttons appear under both tabs
   - Validation, error states, and loading states unchanged

5. Update the footer link inside each form: the login form's footer
   should switch to the register tab rather than navigating away, and
   vice versa.

6. Update all internal links across the site that point at /register to
   point at /login?mode=register, and check the i18n files for both
   button labels in en.json and vi.json.

Test: logged out, click the nav button, land on the login tab, switch
to register, select Creative pro, pick a role, submit — the whole flow
works without a full page reload.
```

---

## 2. Sửa lỗi filter phải bấm nhiều lần

Triệu chứng bạn mô tả (bấm nhiều lần mới chọn được) thường do một trong bốn nguyên nhân: debounce nuốt mất click, checkbox không controlled đúng, router.push gây re-render làm mất state, hoặc vùng bấm quá nhỏ.

```
There's a bug on /browse: clicking a filter checkbox or radio often does
nothing, and I have to click several times before the filter applies.
Diagnose and fix it properly rather than patching symptoms.

Investigate these likely causes in order and report what you find:

1. Debounce swallowing clicks. If filter changes go through a debounced
   URL update, a click during the debounce window may be overwritten by
   stale state. Debounce is correct for the free-text search input but
   wrong for checkboxes and radios — those should apply immediately.
   Separate the two: instant updates for discrete controls, debounce
   only for text input.

2. Uncontrolled or half-controlled inputs. Check whether the Checkbox
   and Radio components in src/components/ui/ are fully controlled
   (checked + onChange from props) or whether they hold internal state
   that fights with the URL state. If the checked prop is derived from
   searchParams but the component also keeps its own useState, they
   will desync. Make the URL the single source of truth.

3. Re-render resetting state. Every router.push on a Server Component
   page triggers a refetch and re-render. If the filter sidebar is
   remounting on each navigation, in-flight clicks get lost. Verify the
   sidebar is not being remounted — check its key prop and where it
   sits in the tree. Consider useOptimistic or useTransition so the UI
   updates instantly while the server catches up.

4. Click target and event handling. Check that the label is properly
   associated with the input (htmlFor/id, or the input nested inside
   the label) so clicking the text works, not just the 18px box. Verify
   there is no preventDefault or stopPropagation blocking the first
   click, and that the hit area is at least 44px tall on touch devices.

After diagnosing, implement the fix:

- Wrap filter updates in useTransition and show a subtle loading state
  (dim the results, keep the sidebar fully interactive) instead of
  blocking input
- Apply the checkbox/radio change to local optimistic state immediately,
  then sync the URL
- Make the whole label row clickable with a comfortable hit area
- Batch rapid successive changes into one navigation rather than one
  per click

Then verify by testing:
- Single click on each of the five role checkboxes registers first time
- Rapidly clicking three roles in a row applies all three
- Clicking the label text works the same as clicking the box
- Sort radios switch on the first click
- City and Budget selects apply immediately
- Reset filters clears everything in one click
- Back button restores the previous filter state
- The same on touch: test on a real phone, not just DevTools

Report which of the four causes it actually was.
```

---

## 3. Thêm role mới: Model

Đây là thay đổi lớn — chạm vào enum, permissions, pricing, đăng ký, search, booking. Chia làm ba prompt.

### 3a — Data layer và permissions

```
Add a new role: MODEL. Models are booked BY photographers and
videographers for shoots — the reverse direction of the Customer→
Provider flow, similar to how Make-up Artist works today.

Data layer changes:

1. Add MODEL to the Role enum in prisma/schema.prisma. Create the
   migration.

2. Add model-specific fields to the Profile model (all optional, only
   used when role is MODEL):
   - height (Int?, cm)
   - measurements (String?, free text so it stays flexible)
   - hairColor (String?)
   - eyeColor (String?)
   - shoeSize (String?)
   - experienceLevel (enum: NEW, INTERMEDIATE, EXPERIENCED, PROFESSIONAL)
   - travelWilling (Boolean, default false)
   - agencyRepresented (Boolean, default false)
   - agencyName (String?)

   These are self-reported and optional — do not make any of them
   required, and do not display empty fields on the profile.

3. Add model categories to the ProfileCategory enum:
   FASHION_MODEL, COMMERCIAL_MODEL, FITNESS_MODEL, PORTRAIT_MODEL,
   HAND_FOOT_MODEL, PLUS_SIZE, PETITE, MATURE, ALTERNATIVE

4. Update the permission matrix in .claude/skills/role-permissions/
   SKILL.md. MODEL has the same capabilities as MAKEUP_ARTIST:
   can upload portfolio, list services, receive bookings, post to feed.
   Cannot list products.

5. Update the "who can book whom" table:
   - Photographer can book: Make-up Artist, Studio, Model
   - Videographer can book: Make-up Artist, Studio, Model
   - Customer can book: Photographer, Videographer, Make-up Artist,
     Studio, Model
   - Model receives bookings only

6. Add MODEL to src/lib/constants/plans.ts with its subscription price.
   I suggest pricing it the same as Make-up Artist.

7. Update every place the roles are enumerated in code — search for
   MAKEUP_ARTIST across the codebase and check each hit to see whether
   MODEL belongs there too. Report any spot where you were unsure.
```

### 3b — Xác minh tuổi và an toàn

Phần này quan trọng và không nên bỏ qua. Nền tảng có model profile với ảnh cá nhân cần bảo vệ người dùng, đặc biệt là ngăn người dưới 18 tuổi đăng ký.

```
Before the Model role goes live, add safeguards. A platform hosting
personal photos of people needs these — they protect users and protect
the business.

1. Age gate on the Model role specifically:
   - Date of birth is required when registering for the MODEL role
   - Block registration if the calculated age is under 18
   - Store dateOfBirth on the User model (private, never displayed)
   - Display only an age range on the profile (e.g., "18–24"), never
     the exact birth date

2. Identity verification for Model accounts:
   - Add a verification step: upload a government ID photo
   - Store it in a private Cloudinary folder, never publicly accessible
   - Add verificationStatus to UserRole:
     enum VerificationStatus { UNVERIFIED, PENDING, VERIFIED, REJECTED }
   - Model profiles cannot be published until VERIFIED
   - Admin panel gets a verification queue: view the ID, compare with
     the profile photo, approve or reject with a reason
   - Show a "Verified" badge on approved profiles
   - Auto-delete the ID image 30 days after approval — keep only the
     verification decision and the reviewer

3. Content policy for Model portfolios:
   - Add a content guidelines acceptance step during Model onboarding
   - Write the guidelines page at /guidelines covering: no nudity, no
     sexually suggestive content, no images of anyone under 18, model
     must have rights to the images they upload
   - Add a "Report this profile" button on every profile with reasons
     including "Inappropriate content" and "Appears to be a minor"
   - Route those two reasons to a high-priority admin queue

4. Safety features for Models:
   - Privacy setting: hide exact location, show city only
   - Option to require a booking deposit before sharing contact details
   - A safety notice shown before the first booking: meet in public or
     at a registered studio for the first shoot, tell someone where you
     are, Fgrapher never asks for payment outside the platform
   - Block and report available from any conversation

5. Add these to the Terms of Service:
   - Minimum age 18 for Model accounts
   - Verification requirement
   - Content standards and consequences of violation
   - The platform's role as an intermediary, not an employer or agency

Implement 1, 3, and 4 now. For 2 (ID verification), build the data
model and admin queue but let me decide whether to require it at
launch or start with a lighter check.
```

### 3c — UI cho Model role

```
Add the Model role throughout the UI, matching my existing design system.

1. Registration (/login?mode=register):
   - Add Model to the role checkbox list under "Creative pro"
   - Icon: Sparkles or UserRound from lucide-react
   - Label "Model", price tag from the plans constant
   - Description line: "Get booked for shoots and build your portfolio"
   - When Model is checked, reveal the date-of-birth field

2. Browse page (/browse):
   - Add Model to the ROLE filter checkboxes, after Make-up Artist
   - Add the model categories to the STYLE filter when Model is
     selected
   - Add Model-specific filters that only appear when the Model role
     filter is active: height range, experience level, travel willing
   - Update the role counts to include Model

3. Navigation:
   - Add Model to the DISCOVER column in the footer
   - Add to the landing page hero role filter tags
   - Add to the "Featured near you" role mix

4. Profile page for Model role:
   - Portfolio tab is the primary tab (models are visual-first)
   - Add a "Details" section above the tabs showing the optional
     attributes that are filled in — height, experience level, travel
     willing, agency. Render as a clean label/value grid, skip empty
     fields entirely, never show placeholder dashes
   - Show the age range badge next to the location
   - Show the Verified badge if verification is approved
   - Services tab: model rate cards (per hour, per half day, per day,
     TFP/collaboration)
   - Add "TFP available" as a badge if the model offers
     time-for-print collaboration — this is standard in the industry
     and worth surfacing

5. Profile editor:
   - Add the Model fields section to /dashboard/settings/profile,
     shown only when the user has the Model role
   - All fields optional with helper text explaining they are shown
     publicly
   - Privacy toggles: hide exact location, hide measurements

6. Dashboard:
   - Model role gets the same sidebar items as Make-up Artist:
     Overview, Bookings, Portfolio, Messages, Settings
   - Booking requests from photographers show the shoot type and
     usage rights in the request details

7. Booking flow additions when booking a Model:
   - Shoot type select: Editorial, Commercial, Portfolio building,
     TFP collaboration, Event, Other
   - Usage rights field: where the images will be used
   - Wardrobe/styling notes
   - Whether a make-up artist is provided
   - These go in Step 3 (details) of the existing booking flow

8. Pricing page:
   - Add the Model plan card between Make-up Artist and Studio
   - Feature list: public profile with portfolio, unlimited uploads,
     booking calendar, direct messaging with photographers, reviews,
     search visibility, verified badge

9. i18n:
   - Add all new strings to en.json and vi.json
   - Vietnamese: "Người mẫu" for Model, "Chiều cao" height,
     "Kinh nghiệm" experience, "Sẵn sàng di chuyển" travel willing

Test: register a Model account, complete the profile, verify it appears
in browse under the Model filter, and that a photographer account can
book it.
```

---

## 4. Tạo bộ documentation để maintain

Bốn tài liệu, chạy lần lượt.

### 4a — Tài liệu kiến trúc hệ thống

```
Read the entire codebase and generate docs/ARCHITECTURE.md — a technical
reference for maintaining this project.

Include:

1. System overview
   - One-paragraph description of what Fgrapher is
   - Architecture diagram in Mermaid: browser → Next.js (Vercel) →
     Prisma → Supabase Postgres, plus Cloudinary, Stripe, Resend,
     and the real-time layer

2. Tech stack table — every dependency that matters, its version, what
   it is used for, and where the config lives

3. Folder structure — annotated tree explaining what belongs in each
   directory, with the rule for deciding where new code goes

4. Data model
   - Mermaid ER diagram of all Prisma models and their relations
   - A table per model: field, type, purpose, indexes
   - The multi-role architecture explained: why User → UserRole →
     Profile is three tables and not one

5. Request lifecycle — trace one concrete example end to end: a user
   searching on /browse. Which files run in what order, where the data
   comes from, what is cached.

6. Authentication and authorization
   - How NextAuth is configured, where the session shape is defined
   - The role and subscription guard helpers and when to use each
   - Middleware behaviour per route group

7. External integrations — for each of Cloudinary, Stripe, Resend, and
   the realtime provider: what it does, which files touch it, what env
   vars it needs, and what breaks if it goes down

8. Environments — dev, preview, production: which database, which keys,
   how to deploy, how to roll back

9. Conventions — the API response shape, error handling pattern,
   naming rules, and the Server vs Client Component decision rule

Write it for someone competent who has never seen this codebase. Be
concrete and reference real file paths. Where you find something in the
code that contradicts what a convention should be, note it as technical
debt in a section at the end rather than describing it as intended.
```

### 4b — Tài liệu tính năng

```
Generate docs/FEATURES.md — a functional specification of everything
the product currently does.

For each feature area, document: what it does, who can use it (by role),
the user-facing flow step by step, the business rules that govern it,
and the known limitations.

Cover:
1. Accounts and roles — registration, the six (soon seven) roles,
   multi-role behaviour, the free vs paid distinction
2. Subscriptions — plans, trial, billing cycle, what happens on failed
   payment, grace period, cancellation, reactivation
3. Profiles — what each role's profile contains, publishing rules,
   completeness requirements
4. Portfolio — upload limits, supported formats, ordering, deletion
5. Search and discovery — every filter, how sorting works, how ranking
   is calculated, what makes a profile appear or not appear
6. Booking — the full state machine with a Mermaid diagram of valid
   transitions, who can trigger each, timing rules, cancellation policy
7. Availability — how the calendar is calculated from weekly schedule,
   blocked dates, and existing bookings
8. Messaging — conversation creation, real-time behaviour, read
   receipts, blocking
9. Marketplace — listing, cart, checkout, orders, rentals, deposits
10. Reviews — eligibility, submission window, provider response,
    how ratings aggregate
11. Notifications — every trigger, the channel used, and user controls
12. Admin — every action an admin can take and its effect

Add a "Business rules" appendix listing every hard rule in one place,
so I can check consistency: minimum booking notice, cancellation
windows, review eligibility, subscription grace period, upload limits,
rate limits, and so on. Extract these from the actual code, not from
assumption, and flag any rule that is duplicated in more than one place
with different values.
```

### 4c — Sổ tay vận hành

```
Generate docs/OPERATIONS.md — the runbook for actually operating this
platform day to day.

Sections:

1. Daily checklist — what to look at every morning: Sentry errors,
   failed payments, moderation queue, new signups, support inbox.
   Include the exact URL or query for each.

2. Account management procedures — step by step for:
   - Granting admin access to someone
   - Manually verifying a provider
   - Comping a subscription (free access without payment)
   - Suspending an account and what the user experiences
   - Handling a deletion request (including what data is retained
     and the legal basis)
   - Merging duplicate accounts
   - Resetting a user's password on their behalf
   For each: who can do it, the exact steps, and what gets logged

3. Content moderation — the review queue workflow, decision criteria
   for each report reason, what action fits which severity, and how to
   document the decision. Include a short escalation policy for
   anything involving a suspected minor, threats, or illegal content:
   act immediately, preserve evidence, do not delete before recording.

4. Payments operations — how to issue a refund, handle a chargeback,
   investigate a failed payment, reconcile a payout dispute, and what
   to tell a user in each case

5. Database operations — how to safely query production, how to take a
   manual backup, how to restore, how to run a migration on production,
   and the list of things never to run against production

6. Incident response — severity levels, who to notify, how to enable
   maintenance mode, how to roll back a deployment, and a post-incident
   template

7. Monitoring — every alert configured, what it means, and the first
   three things to check when it fires

8. Support playbook — the ten most likely user questions with a
   suggested reply in Vietnamese and English:
   payment failed, can't upload, booking not showing, how to cancel,
   how to change role, forgot password, profile not appearing in
   search, refund request, report a user, delete my account

9. Recurring tasks — weekly, monthly, quarterly: what to review, what
   to clean up, what to report on

Write it so someone who is not me could run the platform for a week
using only this document.
```

### 4d — Hướng dẫn phát triển tiếp

```
Generate docs/DEVELOPMENT.md — the guide for changing this codebase
safely.

Include:

1. Local setup from zero — clone, install, env vars, database, seed,
   run. Every command, in order, with what to expect at each step and
   the three most common setup failures and their fixes.

2. Development workflow — branch naming, commit format, how to test
   locally, how preview deploys work, what must pass before merging

3. Common tasks with step-by-step recipes:
   - Adding a new page
   - Adding a new API route
   - Adding a field to an existing model
   - Adding a new role (reference what was done for MODEL)
   - Adding a new email template
   - Adding a new notification type
   - Adding a translation string
   Each recipe lists every file that must be touched, in order, so
   nothing is forgotten.

4. Testing — how to run the test suite, how to write a new E2E test,
   what must have test coverage, and how to test payment flows safely

5. Database changes — the migration workflow, how to write a safe
   migration, how to handle a destructive change, and how to test a
   migration against a copy of production data

6. Debugging guide — how to trace a problem in each layer, useful
   Prisma logging, how to inspect a Stripe event, how to read the
   Vercel function logs

7. Performance — what to measure, the current baseline numbers, common
   causes of slowness in this codebase specifically

8. Technical debt register — everything you noticed while reading the
   code that should be cleaned up eventually. For each: what it is,
   where, why it is a problem, and roughly how much work to fix. Be
   honest and specific; this is the most useful section for future me.

9. Roadmap parking lot — features discussed but not built, with enough
   context to pick them up later
```

---

## Thứ tự chạy

1. Prompt 1 (gộp button) — nhanh, 30 phút
2. Prompt 2 (sửa filter) — sửa bug đang ảnh hưởng người dùng
3. Prompt 4a → 4b (docs kiến trúc và tính năng) — làm **trước** khi thêm Model, để có bản ghi trạng thái hiện tại làm mốc so sánh
4. Prompt 3a → 3b → 3c (thêm Model role)
5. Prompt 4c → 4d (docs vận hành và phát triển) — làm sau cùng để bao gồm luôn Model

Sau mỗi prompt, chạy `pnpm build` và kiểm tra trên trình duyệt trước khi sang bước tiếp theo.
