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

| Role             | Paid                        | Can upload portfolio/media | Can list services     | Can list products   | Receives bookings         | Can send booking requests | Profile type                                                              |
| ---------------- | --------------------------- | -------------------------- | --------------------- | ------------------- | ------------------------- | ------------------------- | ------------------------------------------------------------------------- |
| PHOTOGRAPHER     | Yes                         | Yes                        | Yes                   | No                  | Yes                       | Yes (see below)           | Portfolio + services                                                      |
| VIDEOGRAPHER     | Yes                         | Yes                        | Yes                   | No                  | Yes                       | Yes (see below)           | Portfolio + services                                                      |
| MAKEUP_ARTIST    | Yes                         | Yes                        | Yes                   | No                  | Yes                       | No                        | Portfolio + services                                                      |
| STUDIO           | Yes                         | Yes                        | Yes                   | No                  | Yes                       | No                        | Location + amenities                                                      |
| CAMERA_SHOP      | Yes                         | Yes (product images)       | No                    | Yes                 | No (orders, not bookings) | No                        | Shop + product listings                                                   |
| **MODEL**        | Yes                         | Yes                        | Yes (rate cards)      | No                  | Yes                       | No                        | Portfolio, visual-first                                                   |
| **COSTUME_SHOP** | Yes                         | Yes                        | Yes (rental packages) | Planned (phase 13A) | Yes                       | No                        | Shop address + rental packages                                            |
| CUSTOMER         | No                          | No                         | No                    | No                  | No                        | Yes                       | Minimal profile                                                           |
| ADMIN            | No (not subscription-gated) | No                         | No                    | No                  | No                        | No                        | N/A — granted via `scripts/make-admin.ts`, not selectable at registration |

MODEL has the same capability profile as MAKEUP_ARTIST: can upload
portfolio, list services, receive bookings, post to feed. **Cannot** list
marketplace products.

## Who can book whom

A booking request flows from an initiator to a receiver. Today's rules:

| Initiator     | Can book                                                                |
| ------------- | ----------------------------------------------------------------------- |
| CUSTOMER      | Photographer, Videographer, Make-up Artist, Studio, Model, Costume Shop |
| PHOTOGRAPHER  | Make-up Artist, Studio, Model, Costume Shop                             |
| VIDEOGRAPHER  | Make-up Artist, Studio, Model, Costume Shop                             |
| MAKEUP_ARTIST | — (receives bookings only)                                              |
| STUDIO        | Costume Shop                                                            |
| MODEL         | Costume Shop                                                            |
| CAMERA_SHOP   | — (marketplace orders, not bookings)                                    |
| COSTUME_SHOP  | — (receives bookings only)                                              |

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

## COSTUME_SHOP (added 21/09/2026)

"Shop cho thuê trang phục" — a costume/outfit rental shop, the project
owner's decision. It behaves like STUDIO today: a booking is a rental for a
date, it has a street address (so it appears on Fmap), a portfolio and
rental packages. Every provider role can book one, because a costume rental
is the one thing a studio or a model books for a shoot.

Listing individual outfits as rental products is phase 13A — see
`docs/guides/phase-13-marketplace-social.md`. Until then the role works
entirely through bookings.

Categories: AO_DAI, WEDDING_DRESS, MENSWEAR, EVENING_GOWN, HISTORICAL,
COSPLAY, KIDSWEAR, ACCESSORIES. Seed account: `costume@test.com`.

## Chợ F — who may list products (21/09/2026)

The marketplace sells and rents **photo/video equipment only**. `SELLER_ROLES`
in `src/lib/constants/index.ts` is `CAMERA_SHOP`, `PHOTOGRAPHER`,
`VIDEOGRAPHER`, `STUDIO` — gear owners, not just shops. Every STUDIO may list;
there is no "has a shooting crew" flag and the project owner decided not to add
one (a studio with no spare gear simply lists nothing).

`COSTUME_SHOP` may **not** list products. Its outfits live on its own profile
as a costume catalogue (photo + daily rental price + deposit), and it receives
bookings like any other provider. `SHOP_ROLES` (`CAMERA_SHOP`, `COSTUME_SHOP`)
is the separate, smaller set of roles that trade under a business name.
