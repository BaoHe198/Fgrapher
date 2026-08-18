# Fgrapher — Development Guides

Bộ hướng dẫn đầy đủ từ Phase 1 đến Phase 12, mỗi phase có prompts sẵn để paste vào Claude Code.

---

## Cách sử dụng

### 1. Copy design reference vào project

```bash
mkdir -p docs/design-reference
cp Fgrapher_Web_UI_Kit.html docs/design-reference/
```

### 2. Mở Claude Code trong project

```bash
cd your-project
claude
```

### 3. Đầu mỗi session, cho Claude Code đọc design

```
Read docs/design-reference/Fgrapher_Web_UI_Kit.html — this is my design
system export. Extract the color tokens, typography scale, spacing,
and component patterns. Use this as the visual reference for everything
I ask you to build. Also read CLAUDE.md for project conventions.
```

### 4. Làm theo từng guide

Mỗi guide có các Step. Với mỗi Step:
1. Đọc phần mô tả để hiểu mục tiêu
2. Copy prompt trong khối code
3. Paste vào Claude Code
4. Review kết quả, chạy `pnpm dev` kiểm tra
5. Nếu chưa đúng, mô tả cụ thể chỗ cần sửa

**Đừng chạy nhiều Step cùng lúc.** Làm xong một Step, kiểm tra, rồi mới sang Step tiếp theo.

---

## Danh sách các Phase

| # | Phase | Thời gian | File | Design |
|---|-------|-----------|------|--------|
| 1 | Landing & Navigation | 1 tuần | `phase-1-landing-nav.md` | LandingScreen, WebNav |
| 2 | Authentication | 1 tuần | `phase-2-auth.md` | AuthScreens |
| 3 | Dashboard | 2 tuần | `phase-3-dashboard.md` | DashboardScreen |
| 4 | Public Profiles | 2 tuần | `phase-4-profiles.md` | WebProfileScreen |
| 5 | Browse & Search | 2 tuần | `phase-5-browse-search.md` | BrowseScreen |
| — | **MVP LAUNCH** | — | — | — |
| 6 | Booking Flow | 2 tuần | `phase-6-booking.md` | BookingFlowScreen |
| 7 | Subscription & Payments | 2 tuần | `phase-7-payments.md` | SubscriptionScreen |
| 8 | Messaging | 2 tuần | `phase-8-messaging.md` | ChatDock |
| 9 | Marketplace | 2 tuần | `phase-9-marketplace.md` | Listings + Gear tabs |
| 10 | Reviews & Ratings | 1 tuần | `phase-10-reviews.md` | Reviews tab |
| 11 | Polish & Performance | 2 tuần | `phase-11-polish.md` | i18n.js |
| 12 | Admin & Launch | 1-2 tuần | `phase-12-admin-launch.md` | — |

**Tổng: khoảng 20 tuần** nếu làm full-time. Có thể soft launch sau Phase 5 (tuần 8).

---

## Design system tóm tắt

Lấy từ Claude Design của bạn:

**Colors:**
- Brand green (hue 168): `--green-50` → `--green-950`
- Brand gold (hue 38): `--gold-50` → `--gold-900`
- Warm greige neutrals (hue 30): `--neutral-0` → `--neutral-950`
- Primary: `var(--green-800)` · Accent: `var(--gold-400)`
- Dark mode: đầy đủ, scale neutral đảo ngược

**Layout:**
- Max width: 1240px
- Page padding: 32px
- Nav height: 72px (sticky, blur)
- Dashboard sidebar: 232px · Browse sidebar: 268px
- Card gaps: 20px · Section gaps: 32px

**Logo:** Dual Lens — hai hình vuông bo góc chồng nhau (#123832 + #C9A66B)

**Tagline:** Find Your Artist

---

## Thứ tự ưu tiên nếu muốn launch nhanh

Nếu bạn muốn ra mắt sớm nhất có thể, làm theo thứ tự này:

**Tối thiểu (6-8 tuần):**
1. Phase 1 — Landing
2. Phase 2 — Auth
3. Phase 4 — Profiles (bỏ qua Phase 3 dashboard phức tạp, làm bản đơn giản)
4. Phase 5 — Browse

Ở mức này users có thể đăng ký, tạo profile, được tìm thấy. Liên hệ qua thông tin trên profile (chưa cần booking online).

**Sau đó thêm dần:**
5. Phase 7 — Payments (để bắt đầu có doanh thu)
6. Phase 6 — Booking
7. Phase 8 — Messaging
8. Phase 3 — Dashboard đầy đủ
9. Phase 10 — Reviews
10. Phase 9 — Marketplace
11. Phase 11-12 — Polish & Launch

---

## Tips khi làm việc với Claude Code

**Prompt tốt:**
```
Create the booking calendar component. Show a 7-day strip matching
the design in WebProfileScreen: day-of-week labels above day numbers,
busy days grayed at 40% opacity with a dot indicator, selected day
uses bg-brand-primary with text-on-brand. Fetch availability from
/api/availability/[providerId]. Use date-fns for date handling.
```

**Prompt kém:**
```
Make the booking calendar
```

**Khi kết quả không đúng:**
```
The calendar is close but three things are off:
1. The selected day should use bg-brand-primary, not bg-green-500
2. Busy days need the small dot indicator below the number
3. The strip should start on Monday, not Sunday
Fix these without changing anything else.
```

**Khi gặp lỗi:**
```
/fix The search page returns 0 results even though there are 30
published profiles in the database. Check the Prisma query in
/api/search and the where clause construction.
```

**Kiểm tra định kỳ:**
```
/review src/app/api
```

---

## Cấu trúc project tham khảo

```
fgrapher/
├── CLAUDE.md                    # Project context cho Claude Code
├── .claude/
│   ├── commands/                # Custom slash commands
│   └── skills/                  # Domain knowledge skills
├── docs/
│   ├── design-reference/        # Claude Design export
│   └── guides/                  # Các file phase guide này
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── (public)/            # Landing, browse, profile, shop
│   │   ├── (auth)/              # Login, register, reset
│   │   ├── (dashboard)/         # Dashboard, settings, bookings
│   │   ├── (admin)/             # Admin panel
│   │   └── api/                 # API routes
│   ├── components/
│   │   ├── ui/                  # Primitives
│   │   ├── layout/              # Nav, sidebar, footer
│   │   ├── cards/               # ArtistCard, ProductCard, PostCard
│   │   ├── modals/              # Dialogs
│   │   └── [domain]/            # Feature-specific components
│   ├── lib/                     # db, auth, stripe, cloudinary, utils
│   ├── services/                # Business logic
│   ├── hooks/                   # Custom React hooks
│   ├── messages/                # en.json, vi.json
│   └── types/
└── public/
```
