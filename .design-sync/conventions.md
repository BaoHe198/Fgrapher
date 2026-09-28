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

<FgrapherProvider theme="light">{/* or "dark" */}
  <App />
</FgrapherProvider>
```

## Styling: Tailwind utilities on brand tokens

Style your own layout with Tailwind classes built on the brand tokens - not raw
hex colours, not inline font stacks.

| Purpose | Classes |
|---|---|
| Page / surfaces | `bg-bg-page`, `bg-bg-surface`, `bg-bg-sunken`, `bg-surface-card`, `bg-bg-inverse` |
| Brand | `bg-brand-primary` + `text-text-on-brand`, `bg-brand-accent`, `text-brand-primary`; hero bands `bg-green-900` + `text-gold-50` / `text-green-200`; gold CTA `bg-gold-400` + `text-gold-900` |
| Text | `text-text-primary`, `text-text-secondary`, `text-text-tertiary`, `text-text-link` |
| Borders | `border-border-subtle`, `border-border-default` |
| Status | `text-success` / `bg-success-bg`, `text-warning` / `bg-warning-bg`, `bg-info-bg`, `text-danger` / `bg-danger-bg` |
| Type scale | `text-display-2xl`, `text-display-xl`, `text-display-lg` (Bricolage Grotesque headlines); `text-heading-lg`, `text-heading-md`; `text-body-lg`, `text-body-md`, `text-body-sm`; `text-caption`, `text-caption-upper` |
| Radius / shadow | `rounded-[var(--fg-radius-md)]` (also `-sm`, `-lg`, `-xl`); `shadow-[var(--shadow-sm)]`, `shadow-[var(--shadow-md)]` |
| Page frame | `mx-auto max-w-[1440px] px-8 max-md:px-5` |

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
      <SectionHead title="Nghệ sĩ nổi bật" actionLabel="Xem tất cả" actionHref="/browse" />
      <div className="grid grid-cols-4 gap-5 max-lg:grid-cols-2">
        <ArtistCard artist={{ id: "1", name: "Minh Anh Nhiếp Ảnh", username: "minhanh",
          roles: ["Nhiếp ảnh gia"], city: "Phường Thủ Đức, Thành phố Hồ Chí Minh",
          rating: "5.0", reviews: 12, price: "Từ 2.000.000₫", media: [] }} />
      </div>
      <Button variant="accent" size="lg" className="mt-8">Đặt lịch ngay</Button>
    </div>
  </section>
</FgrapherProvider>
```
