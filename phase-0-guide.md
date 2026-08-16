# Phase 0 — Step-by-step Setup Guide

Follow these steps in order. Each step includes the exact Claude Code prompt you can use.

---

## Step 1: Install prerequisites

Make sure you have these installed on your machine:

```bash
node --version    # v20+ required
pnpm --version    # install: npm install -g pnpm
git --version
```

Set up a PostgreSQL database (pick one):

- **Local:** Install PostgreSQL, create database `fgrapher`
- **Supabase:** Create free project at supabase.com → copy connection string
- **Neon:** Create free project at neon.tech → copy connection string

---

## Step 2: Initialize project with Claude Code

Open your terminal, navigate to where you want the project, then run Claude Code:

```bash
mkdir fgrapher && cd fgrapher
claude
```

Then paste this prompt:

```
Initialize a Next.js 14 project with the following config:
- App Router with src/ directory
- TypeScript (strict mode)
- Tailwind CSS
- ESLint + Prettier
- pnpm as package manager

Then install these dependencies:
- prisma and @prisma/client
- next-auth@beta
- zod
- react-hook-form and @hookform/resolvers
- bcryptjs and @types/bcryptjs
- date-fns

Then install shadcn/ui and add these components:
button, card, input, label, dialog, dropdown-menu, avatar, skeleton,
badge, separator, toast, tabs, calendar, select, textarea, checkbox,
alert, sheet

Set up the folder structure exactly as defined in CLAUDE.md.
Create a lib/utils.ts with the cn() helper function.
```

---

## Step 3: Copy configuration files

Copy the files from this setup package into your project:

```bash
# From the setup package folder:
cp CLAUDE.md /path/to/fgrapher/
cp .env.example /path/to/fgrapher/
cp -r .claude/ /path/to/fgrapher/
cp prisma/schema.prisma /path/to/fgrapher/prisma/
```

Then create your local env:

```bash
cd fgrapher
cp .env.example .env.local
# Edit .env.local with your real DATABASE_URL
```

---

## Step 4: Set up database

In Claude Code:

```
Read the prisma/schema.prisma file. There is a small syntax error in the
Booking model — the "Customer" label on the customer relation should just
be "customer". Fix it, then:

1. Run prisma generate
2. Run prisma migrate dev --name initial_schema
3. Verify the migration was created successfully

If there are any schema errors, fix them and retry.
```

---

## Step 5: Create Prisma client singleton

In Claude Code:

```
Create the Prisma client singleton at src/lib/db.ts following the
Next.js best practice (global singleton to prevent multiple instances
in development). Export it as `db`.
```

---

## Step 6: Set up NextAuth.js

In Claude Code:

```
Set up NextAuth.js v5 with:

1. Create src/lib/auth.ts with authOptions:
   - Credentials provider (email + password login)
   - Google OAuth provider (read client ID/secret from env)
   - PrismaAdapter for session/account storage
   - JWT strategy
   - Custom session callback that includes user ID and roles
   - Custom signIn callback for email verification check

2. Create src/app/api/auth/[...nextauth]/route.ts

3. Create src/components/providers/auth-provider.tsx (SessionProvider wrapper)

4. Add the AuthProvider to src/app/layout.tsx

5. Create src/lib/auth-helpers.ts with:
   - requireAuth() — get session or throw
   - requireRole(userId, role) — check user has role
   - requireActiveSubscription(userId, role) — check paid role is active
   - requirePaidRole(userId) — check user has any active paid role

Make sure the session includes: user.id, user.email, user.name,
user.avatar, user.roles (array of role strings).
Use bcryptjs for password hashing.
```

---

## Step 7: Build registration page

In Claude Code:

```
Build the registration flow:

1. Create src/app/(auth)/register/page.tsx:
   - Form fields: firstName, lastName, email, password, confirmPassword
   - Validate with Zod schema
   - Use react-hook-form
   - Submit to /api/auth/register
   - Show loading state on submit
   - Show error messages inline
   - Link to login page
   - Clean, minimal design with shadcn/ui Card

2. Create src/app/api/auth/register/route.ts:
   - Validate input with Zod
   - Check if email already exists
   - Hash password with bcryptjs
   - Create User in database
   - Auto-assign CUSTOMER role (free)
   - Return success

3. After registration, redirect to /onboarding/roles

Style it to feel premium and creative — this is a photography platform.
Large hero area, the Fgrapher logo at top, subtle background.
```

---

## Step 8: Build login page

In Claude Code:

```
Build the login page at src/app/(auth)/login/page.tsx:
- Email + password form
- "Sign in with Google" button
- "Forgot password?" link
- "Don't have an account? Register" link
- Use next-auth signIn() function
- Handle error states (wrong password, no account)
- Redirect to /dashboard after successful login
- Match the visual style of the register page
```

---

## Step 9: Build role selection (onboarding)

In Claude Code:

```
Build the role selection onboarding page at
src/app/(dashboard)/onboarding/roles/page.tsx:

Show 6 role cards in a responsive grid (2-3 columns):
1. Photographer — camera icon, "Showcase your portfolio and get booked"
2. Videographer — video icon, "Share your reel and find clients"
3. Make-up Artist — palette icon, "Get booked for shoots and events"
4. Studio for Rent — building icon, "List your space for creatives"
5. Camera Shop — shopping bag icon, "Rent or sell your equipment"
6. Customer — user icon, "Find and book creative talent" (default, always on)

Rules:
- Customer is pre-selected and cannot be deselected
- User can select multiple other roles (checkboxes/toggles)
- Roles 1-5 show a "Subscription required" badge
- Selecting a paid role shows monthly price info
- "Continue" button at bottom
- Submit to /api/users/roles — save selected roles to UserRole table
- If any paid role selected, redirect to billing setup (future)
- If only Customer, redirect to /dashboard

Use shadcn/ui Card with hover effects. Icons from lucide-react.
Make it visually appealing — this is a key first impression.
```

---

## Step 10: Build basic dashboard layout

In Claude Code:

```
Build the dashboard layout at src/app/(dashboard)/layout.tsx:

1. Sidebar navigation (collapsible on mobile → Sheet):
   - Fgrapher logo at top
   - Navigation links (adapt based on user roles):
     Common: Dashboard, Feed, Search, Messages, Settings
     Provider roles: My Profile, Bookings, Services
     Camera Shop: Products, Orders
   - User avatar + name at bottom, with dropdown: Profile, Settings, Logout

2. Top bar:
   - Search input (placeholder for now)
   - Notification bell with badge count
   - Role switcher (if user has multiple roles)

3. Main content area with proper max-width and padding

4. Mobile: hamburger menu → Sheet sidebar

Use shadcn/ui components. The sidebar should feel like a modern SaaS app.
Active link highlighted. Clean icons from lucide-react.
```

---

## Step 11: Create dashboard home page

In Claude Code:

```
Build the dashboard home page at src/app/(dashboard)/dashboard/page.tsx:

For now, show a welcome card with:
- "Welcome back, [firstName]!" greeting
- Their active roles as badges
- Quick stats cards (placeholder data for now):
  - Profile views: 0
  - Upcoming bookings: 0
  - New messages: 0
  - Followers: 0
- Quick action buttons based on roles:
  - "Complete your profile" (if profile not set up)
  - "Upload portfolio" (for provider roles)
  - "Browse photographers" (for customers)
- Profile completion progress bar

Make it a proper dashboard — clean grid of cards, responsive.
```

---

## Step 12: Set up package.json scripts

In Claude Code:

```
Add these scripts to package.json:
{
  "db:generate": "prisma generate",
  "db:migrate": "prisma migrate dev",
  "db:push": "prisma db push",
  "db:seed": "npx tsx prisma/seed.ts",
  "db:studio": "prisma studio",
  "db:reset": "prisma migrate reset",
  "format": "prettier --write ."
}
```

---

## Step 13: Create seed file

In Claude Code:

```
Create prisma/seed.ts that populates the database with test data:

- 5 test users with different role combinations:
  1. photographer@test.com — PHOTOGRAPHER + CUSTOMER
  2. videographer@test.com — VIDEOGRAPHER + CUSTOMER
  3. makeup@test.com — MAKEUP_ARTIST + CUSTOMER
  4. studio@test.com — STUDIO + CUSTOMER
  5. shop@test.com — CAMERA_SHOP + CUSTOMER
  6. customer@test.com — CUSTOMER only
  7. multi@test.com — PHOTOGRAPHER + VIDEOGRAPHER + CUSTOMER

- All passwords: "Test1234!"
- Each provider user has a Profile with sample data
- Create some sample services for each provider
- Create availability schedules (Mon-Fri 9-5)

Use bcryptjs to hash passwords. Use Prisma's createMany where possible.
```

---

## Step 14: Test everything

In Claude Code:

```
Run the full test checklist:
1. pnpm build — check for compile errors
2. pnpm lint — check for lint issues
3. pnpm db:seed — populate test data
4. pnpm dev — start the dev server

Then verify:
- Landing page loads at localhost:3000
- Register page works → creates user in DB
- Login page works → redirects to dashboard
- Role selection page shows all 6 roles
- Dashboard shows welcome message with user's name
- Sidebar navigation renders correctly
- Mobile responsive layout works

Report any issues found.
```

---

## Step 15: Git setup and first commit

```bash
git init
echo "node_modules/\n.next/\n.env\n.env.local\nCLAUDE.local.md" > .gitignore
git add .
git commit -m "feat: Phase 0 — project foundation, auth, dashboard skeleton"
```

---

## Phase 0 complete!

You now have:

- Next.js project with TypeScript, Tailwind, shadcn/ui
- PostgreSQL database with full schema
- Authentication (email/password + Google OAuth)
- Registration → Role Selection → Dashboard flow
- Role-based sidebar navigation
- Dashboard home with welcome + stats
- Seed data for testing
- CLAUDE.md + custom commands + skills for Claude Code

**Next: Phase 1** — Build out the profile editor and public profile pages.
