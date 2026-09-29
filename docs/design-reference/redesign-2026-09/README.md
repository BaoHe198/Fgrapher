# Fgrapher — how to build with this design system

Fgrapher is a Vietnamese marketplace for booking photographers, videographers,
makeup artists, models, studios and costume shops, plus Chợ F (photo/video gear
for sale or rent). Every screen is in **Vietnamese**.

## Wrap everything in `FgrapherProvider`

Components read Vietnamese copy through next-intl, the Vietnam time zone, the
theme and shared search-filter state from it. Without it, translated labels
break and the filter components (`SearchInput`, `FilterSidebar`, `ShopFilters`)
throw.

```jsx
const { FgrapherProvider, Button, ArtistCard } = window.Fgrapher;

<FgrapherProvider theme="light">
  {/* or "dark" */}
  <App />
</FgrapherProvider>;
```

## Styling: Tailwind utilities on brand tokens

Style your own layout with Tailwind classes built on the brand tokens - not raw
hex colours, not inline font stacks.

| Purpose         | Classes                                                                                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page / surfaces | `bg-bg-page`, `bg-bg-surface`, `bg-bg-sunken`, `bg-surface-card`, `bg-bg-inverse`                                                                                                                                    |
| Brand           | `bg-brand-primary` + `text-text-on-brand`, `bg-brand-accent`, `text-brand-primary`; hero bands `bg-green-900` + `text-gold-50` / `text-green-200`; gold CTA `bg-gold-400` + `text-gold-900`                          |
| Text            | `text-text-primary`, `text-text-secondary`, `text-text-tertiary`, `text-text-link`                                                                                                                                   |
| Borders         | `border-border-subtle`, `border-border-default`                                                                                                                                                                      |
| Status          | `text-success` / `bg-success-bg`, `text-warning` / `bg-warning-bg`, `bg-info-bg`, `text-danger` / `bg-danger-bg`                                                                                                     |
| Type scale      | `text-display-2xl`, `text-display-xl`, `text-display-lg` (Bricolage Grotesque headlines); `text-heading-lg`, `text-heading-md`; `text-body-lg`, `text-body-md`, `text-body-sm`; `text-caption`, `text-caption-upper` |
| Radius / shadow | `rounded-[var(--fg-radius-md)]` (also `-sm`, `-lg`, `-xl`); `shadow-[var(--shadow-sm)]`, `shadow-[var(--shadow-md)]`                                                                                                 |
| Page frame      | `mx-auto max-w-[1440px] px-8 max-md:px-5`                                                                                                                                                                            |

Palettes `green-50…950`, `gold-50…900` and `neutral-0…950` exist for every
`bg-/text-/border-` utility. Layout utilities (flex, grid, gap, padding,
margin, widths) are standard Tailwind.

## Components first

Use the library before building your own: `Button` (variants primary, accent,
secondary, outline, ghost, destructive, link; sizes sm/md/lg), `Badge`, `Tag`,
`Card`, `Input`, `Textarea`, `NativeSelect`, `CurrencyInput`, `DateField`,
`Checkbox`, `Radio`, `Switch`, `Dialog`, `Sheet`, `DropdownMenu`, `Tabs`,
`Accordion`, `Toaster`, `StarRating`, `SectionHead`, `ArtistCard`, `LogoFull`,
`Footer`, `HeroSearch`, `HeroContactSheet`. Each component's `.prompt.md` shows
its props and examples.

`Card` pads itself: put content directly inside
(`<Card className="flex flex-col gap-4">…</Card>`, or `padding={false}` for
flush images). Don't nest CardHeader/CardContent/CardFooter - they double the
padding.

## Content rules

- All copy in Vietnamese. Money `1.500.000₫` (dot thousands, ₫ with no space).
  Dates `dd/MM/yyyy`. Time zone Asia/Ho_Chi_Minh.
- Places are province + ward, e.g. "Phường Thủ Đức, Thành phố Hồ Chí Minh".
- Photography is the hero: let portfolio images lead, keep chrome quiet.

## Example

```jsx
const { FgrapherProvider, SectionHead, ArtistCard, Button } = window.Fgrapher;

<FgrapherProvider>
  <section className="bg-bg-page">
    <div className="mx-auto max-w-[1440px] px-8 py-16 max-md:px-5">
      <SectionHead
        title="Nghệ sĩ nổi bật"
        actionLabel="Xem tất cả"
        actionHref="/browse"
      />
      <div className="grid grid-cols-4 gap-5 max-lg:grid-cols-2">
        <ArtistCard
          artist={{
            id: "1",
            name: "Minh Anh Nhiếp Ảnh",
            username: "minhanh",
            roles: ["Nhiếp ảnh gia"],
            city: "Phường Thủ Đức, Thành phố Hồ Chí Minh",
            rating: "5.0",
            reviews: 12,
            price: "Từ 2.000.000₫",
            media: [],
          }}
        />
      </div>
      <Button variant="accent" size="lg" className="mt-8">
        Đặt lịch ngay
      </Button>
    </div>
  </section>
</FgrapherProvider>;
```

# Fgrapher (fgrapher@0.1.0)

This design system is the published fgrapher React library, bundled as a single
browser global. All 64 components are the real upstream code.

## Where things are

- `_ds_bundle.js` — the whole-DS bundle at the project root; loads every component to `window.Fgrapher`. First line is a `/* @ds-bundle: … */` metadata header.
- `styles.css` — the single stylesheet entry: it `@import`s the tokens, fonts, and component styles (`_ds_bundle.css`). Link this one file.
- `components/<group>/<Name>/<Name>.prompt.md` (example JSX + variants), `<Name>.d.ts` (types), `<Name>.html` (variant grid).
- `tokens/*.css` — CSS custom properties, names verbatim from upstream.
- `fonts/` — `@font-face` files + `fonts.css` (when the package ships fonts).
- `guidelines/` — the design system's own usage guidance (1 doc(s), see `guidelines/index.md`). Read these before composing larger layouts.

For a specific component, `read_file("components/<group>/<Name>/<Name>.prompt.md")`.

## Loading

Add these two lines to your page once (React must be on the page first):

```html
<link rel="stylesheet" href="styles.css" />
<script src="_ds_bundle.js"></script>
```

Components are then available at `window.Fgrapher.*`. Mount into a dedicated child node (e.g. `<div id="ds-root">`), not the host page's own React root, so the two trees don't collide:

```jsx
const { Accordion } = window.Fgrapher;
ReactDOM.createRoot(document.getElementById("ds-root")).render(<Accordion />);
```

Wrap the tree in the provider — most components read theme/i18n from context:

```jsx
<FgrapherProvider>{children}</FgrapherProvider>
```

## Tokens

273 CSS custom properties from fgrapher. Names are
preserved verbatim from upstream. They are declared inside `_ds_bundle.css` (this DS ships one compiled stylesheet rather than separate token files).

- **color** (54): `--color-orange-500`, `--color-blue-500`, `--color-black`, …
- **spacing** (7): `--tw-space-y-reverse`, `--tw-space-x-reverse`, `--gap`, …
- **typography** (15): `--font-sans`, `--font-mono`, `--font-weight-normal`, …
- **radius** (7): `--radius-sm`, `--radius-md`, `--radius-lg`, …
- **shadow** (12): `--shadow-sm`, `--shadow-md`, `--shadow-lg`, …
- **other** (178): `--spacing`, `--container-xs`, `--container-sm`, …

## Components

### general

- `Accordion`
- `Alert`
- `Avatar`
- `Badge`
- `Button`
- `Card`
- `Checkbox`
- `CurrencyInput`
- `DateField`
- `Dialog`
- `DropdownMenu`
- `Input`
- `MediaPlaceholder`
- `NativeSelect`
- `Progress`
- `Radio`
- `SectionHead`
- `Sheet`
- `Skeleton`
- `StarInput`
- `StarRating`
- `Switch`
- `Tabs`
- `Tag`
- `Textarea`
- `Toaster`

### forms

- `AddressAutocomplete`
- `ProductForm`
- `ProductImageUploader`
- `ReferenceMediaField`
- `RoleSelectionForm`

### cards

- `ArtistCard`

### profile

- `AvailabilityDialog`
- `ImageCropDialog`
- `ProfileActions`
- `QrCodeDialog`

### cart

- `CartItemRow`

### messaging

- `ConversationList`
- `MessagesSkeleton`

### layout

- `CookieConsentBanner`
- `Footer`
- `ReviewReminderBannerClient`

### browse

- `FilterSidebar`
- `MobileFilterSheet`
- `SearchInput`
- `WaitlistForm`

### fmap

- `FmapFilterBar`

### brand

- `FrameMark`
- `LogoFull`
- `LogoMark`

### sections

- `HeroContactSheet`
- `HeroSearch`
- `SimplePage`

### modals

- `MediaLightbox`
- `PhoneVerifyDialog`
- `ReportModal`
- `RespondReviewModal`
- `ReviewModal`
- `UploadMediaModal`

### social

- `PostEngagement`

### media

- `ReferenceMediaGallery`

### shop

- `ShopFilters`

### auth

- `SocialRow`
- `SuspendedAccountNotice`
