---
name: role-permissions
description: Reference for Fgrapher's role capability matrix and booking-eligibility rules. Consult before adding a role, a role-gated feature, or a booking-flow change.
---

# Role permissions

Source of truth for what each `Role` (see `prisma/schema.prisma`) can do.
Update this file in the same change as any edit to `src/lib/constants/
index.ts` (`PAID_ROLES`, `PROVIDER_ROLES`, `ROLE_LABELS`,
`BOOKABLE_ROLES_BY_ROLE`) or `src/lib/auth-helpers.ts`'s guard functions —
they should never drift apart.

## Capability matrix

| Role | Paid | Can upload portfolio/media | Can list services | Can list products | Receives bookings | Can send booking requests | Profile type |
|---|---|---|---|---|---|---|---|
| PHOTOGRAPHER | Yes | Yes | Yes | No | Yes | Yes (see below) | Portfolio + services |
| VIDEOGRAPHER | Yes | Yes | Yes | No | Yes | Yes (see below) | Portfolio + services |
| MAKEUP_ARTIST | Yes | Yes | Yes | No | Yes | No | Portfolio + services |
| STUDIO | Yes | Yes | Yes | No | Yes | No | Location + amenities |
| CAMERA_SHOP | Yes | Yes (product images) | No | Yes | No (orders, not bookings) | No | Shop + product listings |
| **MODEL** | Yes | Yes | Yes (rate cards) | No | Yes | No | Portfolio, visual-first |
| CUSTOMER | No | No | No | No | No | Yes | Minimal profile |
| ADMIN | No (not subscription-gated) | No | No | No | No | No | N/A — granted via `scripts/make-admin.ts`, not selectable at registration |

MODEL has the same capability profile as MAKEUP_ARTIST: can upload
portfolio, list services, receive bookings, post to feed. **Cannot** list
marketplace products.

## Who can book whom

A booking request flows from an initiator to a receiver. Today's rules:

| Initiator | Can book |
|---|---|
| CUSTOMER | Photographer, Videographer, Make-up Artist, Studio, Model |
| PHOTOGRAPHER | Make-up Artist, Studio, Model |
| VIDEOGRAPHER | Make-up Artist, Studio, Model |
| MAKEUP_ARTIST | — (receives bookings only) |
| STUDIO | — (receives bookings only) |
| MODEL | — (receives bookings only) |
| CAMERA_SHOP | — (marketplace orders, not bookings) |

Encoded as `BOOKABLE_ROLES_BY_ROLE` in `src/lib/constants/index.ts`.

**Important caveat found while adding MODEL:** as of this writing,
`services/bookings.ts`'s `createBooking()` does **not** enforce this table
server-side — the only check is "you can't book yourself"
(`input.providerId === customerId`). Which roles can book which has so far
been an emergent property of which profile pages render a "Book" CTA, not
a server-side rule. If a caller reaches the booking API directly, nothing
currently stops a Make-up Artist from "booking" another Make-up Artist.
This table should be treated as the intended policy for gating UI entry
points (and worth wiring into `createBooking` as an explicit check in a
follow-up — flagged, not fixed, since fixing it wasn't in scope for the
change that created this file).

## Adding a new role — checklist

Based on what MODEL's addition (`docs/guides/fgrapher-prompts-batch-2.md`
§3a) actually touched:

1. `prisma/schema.prisma` — add to the `Role` enum, migrate.
2. `src/lib/constants/index.ts` — `PAID_ROLES`, `PROVIDER_ROLES` (if it
   gets a portfolio+booking dashboard section), `ROLE_LABELS`,
   `BOOKABLE_ROLES_BY_ROLE`.
3. `src/lib/constants/plans.ts` — `ROLE_PLANS` entry + `.env.example`'s
   `STRIPE_PRICE_<ROLE>_MONTHLY/YEARLY` pair.
4. `src/lib/validations/auth.ts`'s `PAID_ROLE_VALUES` and
   `src/lib/validations/subscription.ts`'s `checkoutSchema` role enum —
   both are hardcoded Zod tuples, not derived from `PAID_ROLES` (zod needs
   a literal tuple), so they silently reject the new role at the API layer
   until updated even if the UI offers it.
5. **Every `Record<Role, X>` in the codebase** — TypeScript makes these
   exhaustive, so `tsc --noEmit` after step 1 will list every one that
   needs a new entry (run it — don't grep manually). Adding MODEL broke
   `roles-settings.tsx`'s `ROLE_ICONS` and `pricing-content.tsx`'s
   `COMPARISON_MATRIX`.
6. `prisma/seed.ts` — add a seed account (`ProfileSeed` interface may need
   new optional fields for the new role's role-specific data).
7. This file.
8. UI surfaces (deliberately separate/later step for MODEL — see §3c of
   the prompts file): registration role picker, browse filters, footer,
   landing page, profile page, profile editor, dashboard sidebar, pricing
   page, booking flow, i18n strings.
