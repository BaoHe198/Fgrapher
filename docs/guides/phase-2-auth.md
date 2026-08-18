# Phase 2 — Authentication Screens

**Thời gian:** ~1 tuần
**Design file:** `AuthScreens.jsx` (AuthShell, LoginScreen, RegisterScreen, SocialRow)
**Kết quả:** User đăng ký, chọn role, đăng nhập, quên mật khẩu — UI khớp design.

---

## Chuẩn bị

Phase 0 đã setup NextAuth.js. Phase này build UI + hoàn thiện luồng.

### Bước 0.1 — Kiểm tra NextAuth đang hoạt động

Trong Claude Code:

```
Verify the NextAuth setup from Phase 0:
1. Check src/lib/auth.ts exists with authOptions
2. Check src/app/api/auth/[...nextauth]/route.ts exists
3. Check the session callback includes user.id and user.roles
4. Check src/lib/auth-helpers.ts has requireAuth, requireRole,
   requireActiveSubscription, requirePaidRole

Report what's missing and fix it.
```

---

## Step 1 — Form components

**Prompt:**

```
Read my design file, focus on the AuthScreens component to see the
Input, Checkbox, and Select styles.

Create these form components in src/components/ui/:

1. input.tsx:
   - Label above (text-body-sm, font-semibold, text-primary, mb-1.5)
   - Input: w-full, px-3.5 py-2.5, bg-surface,
     border border-default, rounded-[var(--radius-md)]
   - focus: border-focus (gold-500), ring-2 ring-gold-500/20, outline-none
   - error state: border-danger, plus error message below (text-body-sm, text-danger)
   - Props: label, type, placeholder, error, ...inputProps
   - Use forwardRef so react-hook-form can register it

2. checkbox.tsx:
   - Flex items-center gap-2.5, cursor-pointer
   - Box: 18x18px, rounded-[var(--radius-sm)], border border-default
   - Checked: bg-brand-primary, border-brand-primary, white check icon
   - Label: text-body-md, text-primary
   - Props: label, checked, onChange, disabled

3. radio.tsx:
   - Same layout as checkbox but circular (rounded-full)
   - Checked: border-brand-primary with inner dot (8px, bg-brand-primary)
   - Props: label, checked, onChange, name

4. select.tsx:
   - Label above (same style as input)
   - Select: same box styling as input, with ChevronDown icon on right
   - Props: label, options (string[] or {value,label}[]), value, onChange
   - Use native <select> for simplicity, styled

5. switch.tsx:
   - Toggle: 44x24px track, rounded-full
   - Off: bg-neutral-300. On: bg-brand-primary
   - Thumb: 20px circle, white, translate-x on toggle, transition 150ms
   - Optional label on left (text-body-md)
   - Props: label, checked, onChange

All components: support dark mode, use cn() for class merging,
match my design's colors and spacing exactly.
```

---

## Step 2 — AuthShell layout

**Prompt:**

```
Read the AuthShell component in my design file.

Create src/app/(auth)/layout.tsx matching the design EXACTLY:

Structure: grid grid-cols-2, min-h-[calc(100vh-72px)]

LEFT COLUMN (form area):
- flex items-center justify-center, px-8 py-14
- Inner container: w-full max-w-[400px], flex flex-col gap-[22px]
- This is where {children} renders

RIGHT COLUMN (visual area):
- relative, bg-green-900, flex items-end, p-10
- Absolute background layer (inset-0):
  grid grid-cols-2 grid-rows-2 gap-0.5, opacity-50
  Four MediaPlaceholder components filling the quadrants:
    tint: green-700, gold-700, green-600, neutral-700
    height: 100%
- Foreground blockquote (relative, max-w-[440px], flex flex-col gap-3):
  - P: text-heading-lg, text-gold-50
    Content: "Fgrapher put my portfolio in front of the right clients.
    I book twice as many sessions now."
  - Span: text-body-sm, text-gold-300
    Content: "Ana Reyes — Photographer, Manila"

Responsive:
- < 1024px: hide the right column entirely, left column becomes full width
- < 640px: reduce padding to px-5 py-10

Note: this layout should NOT include the main WebNav — auth pages have
a minimal header (just the logo, centered or left). Add a simple header:
- height 72px, border-b border-subtle, px-8, flex items-center
- Logo only (LogoFull component), links to "/"
```

---

## Step 3 — Login page

**Prompt:**

```
Read the LoginScreen component in my design file.

Create src/app/(auth)/login/page.tsx matching the design EXACTLY:

Content (renders inside AuthShell's left column):

1. Header block (flex flex-col gap-2):
   - H1: text-display-md — "Welcome back"
   - P: text-body-md, text-secondary — "Sign in to manage your bookings
     and portfolio."

2. Form (flex flex-col gap-3.5):
   - Input: label "Email", placeholder "you@studio.com", type email
   - Input: label "Password", type password, placeholder "••••••••"
   - Row (flex items-center justify-between):
     - Checkbox "Remember me" (default checked)
     - Link "Forgot password?" (text-body-sm, font-semibold, text-link)
       → /forgot-password
   - Button: accent variant, lg size, full width — "Sign in"

3. SocialRow component (create inline or as separate component):
   - Divider row: flex items-center gap-3
     - Line (flex-1, h-px, bg-border-subtle)
     - Span "or" (text-body-sm, text-tertiary)
     - Line (flex-1, h-px, bg-border-subtle)
   - Buttons row (flex gap-2.5):
     - Button secondary, flex-1 — "Google" (with Google icon)
     - Button secondary, flex-1 — "Apple" (with Apple icon)

4. Terms text: text-body-sm, text-tertiary
   "By signing in you agree to our Terms and Privacy Policy."

5. Footer: text-body-md, text-secondary
   "Don't have an account? [Sign up]" — link to /register, font-semibold

Functionality:
- Use react-hook-form + zod validation
  Schema: email (valid email, required), password (min 8, required)
- Submit: call signIn('credentials', { email, password, redirect: false })
- On success: router.push('/dashboard')
- On error: show error alert above the form (bg-danger-bg, text-danger,
  rounded, p-3, text-body-sm)
- Loading state: disable button, show spinner, text "Signing in..."
- Google button: signIn('google', { callbackUrl: '/dashboard' })
- Apple button: disabled for now with tooltip "Coming soon"

Add metadata export: title "Sign in — Fgrapher"
```

**Kiểm tra:** Đăng nhập bằng tài khoản seed (`photographer@test.com` / `Test1234!`).

---

## Step 4 — Register page

**Prompt:**

```
Read the RegisterScreen component in my design file. This is the most
complex auth screen — it has role selection built in.

Create src/app/(auth)/register/page.tsx matching the design EXACTLY:

1. Header block:
   - H1: text-display-md — "Create your account"
   - P: text-body-md, text-secondary — "Join Fgrapher and start booking
     or getting booked."

2. "I am a..." section (flex flex-col gap-2):
   - Label: text-caption-upper, tracking-[0.08em], text-tertiary — "I AM A"
   - Grid grid-cols-2 gap-2.5, two selectable cards:

     Card A — Customer:
       Icon: User (20px)
       Title: "Customer" (text-body-md, font-semibold)
       Description: "Book artists and buy gear" (text-body-sm, text-secondary)

     Card B — Provider:
       Icon: Camera (20px)
       Title: "Creative pro" (text-body-md, font-semibold)
       Description: "Get booked and sell" (text-body-sm, text-secondary)

     Card styling:
     - text-left, p-3.5, rounded-[var(--radius-md)], cursor-pointer
     - flex flex-col gap-1.5
     - Unselected: border border-default, bg-surface, icon text-tertiary
     - Selected: border-brand-primary, bg-success-bg, icon text-brand-primary
     - transition 150ms

3. Role checkboxes (ONLY visible when "Creative pro" is selected):
   - Animate in with a smooth height transition
   - Label: text-caption-upper, tracking-[0.08em], text-tertiary
     — "WHAT DO YOU OFFER?"
   - Checkbox list, each row: flex items-center justify-between
     - Left: Checkbox with role name
     - Right: Tag showing monthly price
   - The five roles with prices:
     Photographer — $19/mo
     Videographer — $19/mo
     Make-up Artist — $15/mo
     Studio — $29/mo
     Camera Shop — $29/mo
   - At least one must be selected if "Creative pro" is chosen
   - Note below: text-body-sm, text-tertiary — "You can change this later.
     Customer access is always free."

4. Form fields (flex flex-col gap-3.5):
   - Input: "Full name", placeholder "Ana Reyes"
   - Input: "Email", type email, placeholder "you@studio.com"
   - Input: "Password", type password, placeholder "At least 8 characters"
   - Password strength indicator below (thin bar, 4 segments,
     colors: danger → warning → success as strength increases)

5. Button: accent, lg, full width — "Create account"

6. SocialRow (same as login page)

7. Terms text (same as login)

8. Footer: "Already have an account? [Sign in]" → /login

Functionality:
- react-hook-form + zod schema:
  - name: min 2 chars
  - email: valid email
  - password: min 8, at least one uppercase, one number
  - accountType: 'customer' | 'provider'
  - roles: array, required min 1 if accountType is 'provider'
- Submit to POST /api/auth/register with body:
  { name, email, password, accountType, roles }
- On success:
  - If customer only → signIn then router.push('/dashboard')
  - If provider → signIn then router.push('/onboarding/subscribe')
    (subscription flow comes in Phase 7; for now redirect to /dashboard)
- Error handling: email already exists → inline error on email field

Also update src/app/api/auth/register/route.ts to:
- Accept the roles array
- Always create CUSTOMER role (free)
- Create additional UserRole records for selected paid roles
  with active: false (until subscription is paid)
- Return the created user
```

---

## Step 5 — Forgot password flow

**Prompt:**

```
Create the password reset flow, using the same AuthShell layout:

1. src/app/(auth)/forgot-password/page.tsx:
   - H1: "Reset your password"
   - P: "Enter your email and we'll send you a reset link."
   - Input: "Email"
   - Button accent lg: "Send reset link"
   - Footer link: "Back to sign in" → /login
   - On submit: POST /api/auth/forgot-password
   - Success state: replace form with success message
     (CheckCircle icon, "Check your inbox", instruction text)

2. src/app/api/auth/forgot-password/route.ts:
   - Validate email with zod
   - Find user by email (if not found, still return success —
     don't leak whether the email exists)
   - Generate a secure token, store in VerificationToken table
     with 1-hour expiry
   - Send email via Resend with the reset link:
     ${NEXTAUTH_URL}/reset-password?token=xxx
   - Return { success: true }

3. src/app/(auth)/reset-password/page.tsx:
   - Read token from searchParams
   - H1: "Set a new password"
   - Input: "New password" (with strength indicator)
   - Input: "Confirm password"
   - Button: "Update password"
   - On submit: POST /api/auth/reset-password with { token, password }
   - Success: redirect to /login with a success toast

4. src/app/api/auth/reset-password/route.ts:
   - Validate token exists and not expired
   - Hash new password with bcryptjs
   - Update user, delete the used token
   - Return success

5. Email templates:
   - Create src/lib/email.ts with a sendEmail helper using Resend
   - Create a simple HTML template for the reset email matching
     my brand colors (green-900 header, gold accent button)
```

---

## Step 6 — Auth middleware & route protection

**Prompt:**

```
Set up route protection:

1. Create src/middleware.ts:
   - Protect all routes under /dashboard and /admin
   - Redirect unauthenticated users to /login?callbackUrl=<original>
   - Redirect authenticated users away from /login and /register
     (send them to /dashboard)
   - Use next-auth/middleware or getToken

2. Create src/components/providers/auth-provider.tsx if not exists:
   - SessionProvider wrapper
   - Add to root layout

3. Create src/hooks/use-user-roles.ts:
   export function useUserRoles() {
     const { data: session, status } = useSession()
     const roles = session?.user?.roles ?? []
     return {
       roles,
       isLoading: status === 'loading',
       isAuthenticated: status === 'authenticated',
       hasRole: (role: Role) => roles.includes(role),
       isPaid: roles.some(r => r !== 'CUSTOMER'),
       isCustomerOnly: roles.length === 1 && roles[0] === 'CUSTOMER',
       canUpload: roles.some(r => r !== 'CUSTOMER'),
       canSell: roles.includes('CAMERA_SHOP'),
       canReceiveBookings: roles.some(r =>
         ['PHOTOGRAPHER','VIDEOGRAPHER','MAKEUP_ARTIST','STUDIO'].includes(r)),
     }
   }

4. Update WebNav to use useUserRoles:
   - Show "Sign in" + "Get started" when logged out
   - Show avatar + "Dashboard" when logged in
   - Avatar dropdown: Profile, Settings, Billing, Sign out
```

---

## Step 7 — Test & commit

**Prompt:**

```
Run the full test:
1. pnpm build
2. pnpm lint
3. pnpm dev

Then verify these flows manually:
- Register as Customer only → lands on dashboard
- Register as Creative pro with Photographer + Studio → roles saved in DB
- Login with seeded account photographer@test.com / Test1234!
- Login with wrong password → error message shows
- Forgot password → email sent (check Resend dashboard or console)
- Reset password with token → password updated, can login
- Try accessing /dashboard while logged out → redirects to /login
- Try accessing /login while logged in → redirects to /dashboard
- Dark mode works on all auth pages
- Language toggle works on all auth pages
- Responsive: right visual column hides below 1024px

Report any issues found.
```

**Git commit:**

```bash
git add .
git commit -m "feat(auth): Phase 2 — login, register with role selection, password reset"
```

---

## Checklist hoàn thành Phase 2

- [ ] Form components: Input, Checkbox, Radio, Select, Switch
- [ ] AuthShell layout (split 50/50, visual wall bên phải)
- [ ] Login page với social buttons
- [ ] Register page với role picker (Customer vs Provider + role checkboxes)
- [ ] Forgot password + Reset password flow
- [ ] Email sending qua Resend
- [ ] Middleware bảo vệ routes
- [ ] useUserRoles hook
- [ ] WebNav cập nhật theo trạng thái đăng nhập
- [ ] Test đủ các luồng, build pass

**→ Tiếp theo:** Phase 3 — Dashboard
