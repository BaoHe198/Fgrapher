import {
  PrismaClient,
  type ExperienceLevel,
  type ProfileCategory,
  type Role,
} from "@prisma/client";
import bcrypt from "bcryptjs";

import { PROVINCE_REGISTRY } from "./data/provinces-registry";

const db = new PrismaClient();

const SEED_PASSWORD = "Test1234!";

interface ServiceSeed {
  name: string;
  description: string;
  duration: number;
  price: number;
}

interface ProfileSeed {
  role: Role;
  displayName: string;
  description: string;
  categories?: ProfileCategory[];
  priceMin?: number;
  priceMax?: number;
  address?: string;
  area?: number;
  amenities?: string[];
  shopName?: string;
  services?: ServiceSeed[];
  height?: number;
  measurements?: string;
  hairColor?: string;
  eyeColor?: string;
  shoeSize?: string;
  experienceLevel?: ExperienceLevel;
  travelWilling?: boolean;
}

interface UserSeed {
  email: string;
  location: string;
  // Prompt B4/B8 — name from prisma/data/hcmc-wards.ts, resolved to a real
  // Ward id in main() once seedGeography() has run. HCMC-only for now, so
  // every seed user lives here rather than a fabricated non-HCMC address.
  wardName: string;
  username: string;
  firstName: string;
  lastName: string;
  roles: Role[];
  profiles?: ProfileSeed[];
  // "YYYY-MM-DD" — required for every seed user, not just MODEL, matching
  // CLAUDE.md rule 4 (every account 18+, every role). Also load-bearing
  // for (dashboard)/layout.tsx's onboarding gate: a null dateOfBirth is
  // read as "this is a Google OAuth account that never completed
  // /onboarding/complete-profile" — every seed account needs a real value
  // here or it would get redirected there on every dashboard visit.
  dateOfBirth: string;
}

const PHOTOGRAPHER_SERVICES: ServiceSeed[] = [
  {
    name: "Gói chụp ảnh cưới trọn gói",
    description: "Trọn ngày, hai thợ chụp, album ảnh kỹ thuật số đã chỉnh sửa.",
    duration: 480,
    price: 15_000_000,
  },
  {
    name: "Buổi chụp ảnh chân dung",
    description:
      "Chụp một tiếng tại studio hoặc ngoại cảnh, 20 ảnh đã chỉnh sửa.",
    duration: 60,
    price: 2_000_000,
  },
];

const VIDEOGRAPHER_SERVICES: ServiceSeed[] = [
  {
    name: "Gói quay phim cưới trọn gói",
    description:
      "Trọn ngày, có clip teaser trong ngày và phim highlight đầy đủ.",
    duration: 480,
    price: 20_000_000,
  },
  {
    name: "Video highlight sự kiện",
    description: "Quay nửa ngày sự kiện, dựng thành video highlight 3-5 phút.",
    duration: 240,
    price: 8_000_000,
  },
];

const MAKEUP_SERVICES: ServiceSeed[] = [
  {
    name: "Trang điểm cô dâu",
    description: "Trang điểm thử trước và trang điểm chính ngày cưới.",
    duration: 90,
    price: 2_500_000,
  },
  {
    name: "Trang điểm sự kiện",
    description: "Trang điểm cho tiệc, chụp ảnh hoặc sự kiện.",
    duration: 60,
    price: 1_200_000,
  },
];

const MODEL_SERVICES: ServiceSeed[] = [
  {
    name: "Đặt lịch theo giờ",
    description: "Một tiếng chụp, tại bất kỳ địa điểm nào trong thành phố.",
    duration: 60,
    price: 800_000,
  },
  {
    name: "Đặt lịch nửa ngày",
    description: "Buổi chụp 4 tiếng cho editorial hoặc thương mại.",
    duration: 240,
    price: 2_800_000,
  },
];

const STUDIO_SERVICES: ServiceSeed[] = [
  {
    name: "Thuê studio nửa ngày",
    description: "Thuê 4 tiếng, kèm phông cyclorama và bộ đèn cơ bản.",
    duration: 240,
    price: 1_500_000,
  },
  {
    name: "Thuê studio trọn ngày",
    description: "Thuê 8 tiếng, kèm phông cyclorama và bộ đèn cơ bản.",
    duration: 480,
    price: 2_800_000,
  },
];

const USERS: UserSeed[] = [
  {
    email: "photographer@test.com",
    location: "Phường Bến Thành, Thành phố Hồ Chí Minh",
    wardName: "Phường Bến Thành",
    username: "minhanhnguyen",
    firstName: "Minh Anh",
    lastName: "Nguyễn",
    dateOfBirth: "1994-03-12",
    roles: ["PHOTOGRAPHER", "CUSTOMER"],
    profiles: [
      {
        role: "PHOTOGRAPHER",
        displayName: "Minh Anh Nhiếp Ảnh",
        description:
          "Nhiếp ảnh gia cưới và chân dung với 8 năm kinh nghiệm, chuyên ghi lại những khoảnh khắc tự nhiên và trường tồn.",
        categories: ["WEDDING", "PORTRAIT"],
        priceMin: 2_000_000,
        priceMax: 15_000_000,
        services: PHOTOGRAPHER_SERVICES,
      },
    ],
  },
  {
    email: "videographer@test.com",
    location: "Phường Thủ Đức, Thành phố Hồ Chí Minh",
    wardName: "Phường Thủ Đức",
    username: "quochungtran",
    firstName: "Quốc Hùng",
    lastName: "Trần",
    dateOfBirth: "1990-07-22",
    roles: ["VIDEOGRAPHER", "CUSTOMER"],
    profiles: [
      {
        role: "VIDEOGRAPHER",
        displayName: "Quốc Hùng Films",
        description:
          "Quay phim cưới và sự kiện theo phong cách điện ảnh, chuyên kể chuyện bằng hình ảnh tài liệu.",
        categories: ["WEDDING", "EVENT", "MUSIC_VIDEO"],
        priceMin: 5_000_000,
        priceMax: 25_000_000,
        services: VIDEOGRAPHER_SERVICES,
      },
    ],
  },
  {
    email: "makeup@test.com",
    location: "Phường Gia Định, Thành phố Hồ Chí Minh",
    wardName: "Phường Gia Định",
    username: "maihuongle",
    firstName: "Mai Hương",
    lastName: "Lê Thị",
    dateOfBirth: "1996-11-05",
    roles: ["MAKEUP_ARTIST", "CUSTOMER"],
    profiles: [
      {
        role: "MAKEUP_ARTIST",
        displayName: "Mai Hương Makeup",
        description:
          "Chuyên viên trang điểm cô dâu và editorial, nổi tiếng với phong cách tự nhiên, rạng rỡ.",
        categories: ["BRIDAL", "NATURAL", "GLAM"],
        priceMin: 1_000_000,
        priceMax: 5_000_000,
        services: MAKEUP_SERVICES,
      },
    ],
  },
  {
    email: "studio@test.com",
    location: "Phường Bến Thành, Thành phố Hồ Chí Minh",
    wardName: "Phường Bến Thành",
    username: "ducthinhpham",
    firstName: "Đức Thịnh",
    lastName: "Phạm",
    dateOfBirth: "1988-01-30",
    roles: ["STUDIO", "CUSTOMER"],
    profiles: [
      {
        role: "STUDIO",
        displayName: "Đức Thịnh Creative Studio",
        description:
          "Không gian studio sáng, linh hoạt với phông cyclorama và ánh sáng tự nhiên, phù hợp cho chụp ảnh và quay video.",
        categories: ["INDOOR", "CYCLORAMA", "GREEN_SCREEN"],
        priceMin: 500_000,
        priceMax: 2_800_000,
        address: "123 Nguyễn Huệ, Phường Bến Thành, Thành phố Hồ Chí Minh",
        area: 120,
        amenities: ["wifi", "ac", "parking", "changing_room"],
        services: STUDIO_SERVICES,
      },
    ],
  },
  {
    email: "shop@test.com",
    location: "Phường Tân Bình, Thành phố Hồ Chí Minh",
    wardName: "Phường Tân Bình",
    username: "vanlonghoang",
    firstName: "Văn Long",
    lastName: "Hoàng",
    dateOfBirth: "1985-09-18",
    roles: ["CAMERA_SHOP", "CUSTOMER"],
    profiles: [
      {
        role: "CAMERA_SHOP",
        displayName: "Văn Long Camera",
        shopName: "Văn Long Camera",
        description:
          "Cho thuê và bán thiết bị máy ảnh, đèn chiếu sáng — được các nhiếp ảnh gia chuyên nghiệp tin dùng từ 2015.",
        // Camera shops sell via Product listings, not bookable Services.
      },
    ],
  },
  {
    email: "model@test.com",
    location: "Phường An Phú, Thành phố Hồ Chí Minh",
    wardName: "Phường An Phú",
    username: "ngoclinhdo",
    firstName: "Ngọc Linh",
    lastName: "Đỗ",
    roles: ["MODEL", "CUSTOMER"],
    dateOfBirth: "1998-05-14",
    profiles: [
      {
        role: "MODEL",
        displayName: "Ngọc Linh",
        description:
          "Người mẫu thương mại và editorial, 5 năm kinh nghiệm, hoạt động tại Thành phố Hồ Chí Minh.",
        categories: ["COMMERCIAL_MODEL", "FASHION_MODEL"],
        priceMin: 800_000,
        priceMax: 2_800_000,
        services: MODEL_SERVICES,
        height: 175,
        measurements: "34-26-36",
        hairColor: "Đen",
        eyeColor: "Nâu",
        shoeSize: "39",
        experienceLevel: "EXPERIENCED",
        travelWilling: true,
      },
    ],
  },
  {
    email: "customer@test.com",
    location: "Phường Bến Thành, Thành phố Hồ Chí Minh",
    wardName: "Phường Bến Thành",
    username: "giabaonguyen",
    firstName: "Gia Bảo",
    lastName: "Nguyễn",
    dateOfBirth: "1999-04-08",
    roles: ["CUSTOMER"],
  },
  {
    email: "admin@test.com",
    location: "Phường Bến Thành, Thành phố Hồ Chí Minh",
    wardName: "Phường Bến Thành",
    username: "fgrapheradmin",
    firstName: "Thị Ngọc Anh",
    lastName: "Vũ",
    dateOfBirth: "1992-06-15",
    roles: ["ADMIN", "CUSTOMER"],
  },
  {
    email: "multi@test.com",
    location: "Phường Phú Nhuận, Thành phố Hồ Chí Minh",
    wardName: "Phường Phú Nhuận",
    username: "thanhtungbui",
    firstName: "Thanh Tùng",
    lastName: "Bùi",
    dateOfBirth: "1993-12-01",
    roles: ["PHOTOGRAPHER", "VIDEOGRAPHER", "CUSTOMER"],
    profiles: [
      {
        role: "PHOTOGRAPHER",
        displayName: "Thanh Tùng Photography",
        description:
          "Nhiếp ảnh gia tự do, nhận chụp cưới, sự kiện và chân dung.",
        categories: ["WEDDING", "PORTRAIT", "EVENT"],
        priceMin: 1_500_000,
        priceMax: 10_000_000,
        services: PHOTOGRAPHER_SERVICES,
      },
      {
        role: "VIDEOGRAPHER",
        displayName: "Thanh Tùng Films",
        description:
          "Dựng video trong ngày cho tiệc cưới và sự kiện doanh nghiệp.",
        categories: ["WEDDING", "CORPORATE"],
        priceMin: 4_000_000,
        priceMax: 18_000_000,
        services: VIDEOGRAPHER_SERVICES,
      },
    ],
  },
];

// All 7 days (0=Sunday..6=Saturday) — providers decide their own working
// days, the platform doesn't pre-exclude weekends for them (matches
// availability-settings.tsx's DEFAULT_SCHEDULE).
const ALL_WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6];

// Prompt B4/B8 — real administrative geography, one entry per province in
// PROVINCE_REGISTRY (see prisma/data/provinces-registry.ts for how to add
// more once the project owner supplies data for provinces beyond HCMC).
// Upsert-based and idempotent, unlike the delete-then-recreate USERS
// seeding below, since Ward rows may already be referenced by real
// (non-seed) User rows by the time this is re-run in dev.
async function seedGeography() {
  let wardCount = 0;

  for (const { province: provinceData, wards } of PROVINCE_REGISTRY) {
    const province = await db.province.upsert({
      where: { code: provinceData.code },
      create: provinceData,
      update: { name: provinceData.name },
    });

    for (const [index, name] of wards.entries()) {
      const code = String(index + 1).padStart(3, "0");
      await db.ward.upsert({
        where: { provinceId_code: { provinceId: province.id, code } },
        create: { provinceId: province.id, code, name },
        update: { name },
      });
    }

    wardCount += wards.length;
    console.log(`Seeded province ${province.name} (${wards.length} wards)`);
  }

  console.log(
    `Seeded ${PROVINCE_REGISTRY.length} province(s) and ${wardCount} wards total`,
  );
}

async function main() {
  await seedGeography();

  const wards = await db.ward.findMany({
    select: { id: true, name: true, provinceId: true },
  });
  const wardByName = new Map(
    wards.map((w) => [w.name, { id: w.id, provinceId: w.provinceId }]),
  );

  const emails = USERS.map((u) => u.email);

  const existing = await db.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  if (existing.length > 0) {
    const existingIds = existing.map((u) => u.id);

    // Availability has no FK relation to User in the schema, so it isn't
    // covered by cascade delete — clean it up explicitly before removing users.
    await db.availability.deleteMany({
      where: { userId: { in: existingIds } },
    });

    // Same story for Review -> Booking, and Booking.customer/provider have
    // no onDelete: Cascade (a Restrict FK by default) — delete reviews then
    // bookings referencing these seed users first, or the user delete below
    // fails with a foreign key constraint violation.
    await db.review.deleteMany({
      where: {
        OR: [
          { reviewerId: { in: existingIds } },
          { reviewedId: { in: existingIds } },
        ],
      },
    });
    await db.booking.deleteMany({
      where: {
        OR: [
          { customerId: { in: existingIds } },
          { providerId: { in: existingIds } },
        ],
      },
    });

    // Message.sender/receiver and Order.customer/shop are also no-cascade
    // FKs — clean those up (and their orphaned Conversation rows) too.
    await db.message.deleteMany({
      where: {
        OR: [
          { senderId: { in: existingIds } },
          { receiverId: { in: existingIds } },
        ],
      },
    });
    await db.conversationParticipant.deleteMany({
      where: { userId: { in: existingIds } },
    });
    await db.conversation.deleteMany({ where: { participants: { none: {} } } });
    await db.order.deleteMany({
      where: {
        OR: [
          { customerId: { in: existingIds } },
          { shopId: { in: existingIds } },
        ],
      },
    });

    await db.user.deleteMany({ where: { id: { in: existingIds } } });
  }

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);

  for (const seedUser of USERS) {
    const ward = wardByName.get(seedUser.wardName);
    if (!ward) {
      throw new Error(
        `Seed user ${seedUser.email} references unknown wardName "${seedUser.wardName}" — check prisma/data/hcmc-wards.ts`,
      );
    }
    const wardId = ward.id;

    const user = await db.user.create({
      data: {
        email: seedUser.email,
        username: seedUser.username,
        location: seedUser.location,
        wardId,
        firstName: seedUser.firstName,
        lastName: seedUser.lastName,
        // Vietnamese naming order is family name first (Họ Tên) — the
        // reverse of the firstName/lastName field order, which stays as-is
        // since `firstName` is what greeting() etc. use as the informal
        // given name to address someone by.
        name: `${seedUser.lastName} ${seedUser.firstName}`,
        passwordHash,
        emailVerified: new Date(),
        dateOfBirth: new Date(`${seedUser.dateOfBirth}T00:00:00.000Z`),
      },
    });

    const createdRoles = await Promise.all(
      seedUser.roles.map((role) =>
        db.userRole.create({
          data: {
            userId: user.id,
            role,
            active: true,
            ...(role === "MODEL"
              ? { contentGuidelinesAcceptedAt: new Date() }
              : {}),
          },
        }),
      ),
    );

    // Synthetic ACTIVE subscriptions for every seeded paid role — there's no
    // live Stripe account in this environment, so these aren't backed by a
    // real Stripe subscription (stripeSubscriptionId stays null). Without
    // this, every access-control check added in Phase 7
    // (requireActiveSubscription/requirePaidRole) would reject every seeded
    // account, since a bare UserRole row alone no longer grants access.
    await Promise.all(
      createdRoles
        .filter((ur) => ur.role !== "CUSTOMER" && ur.role !== "ADMIN")
        .map((ur) => {
          const now = new Date();
          const periodEnd = new Date(now);
          periodEnd.setDate(periodEnd.getDate() + 30);
          return db.subscription.create({
            data: {
              userRoleId: ur.id,
              plan: ur.role,
              status: "ACTIVE",
              currentPeriodStart: now,
              currentPeriodEnd: periodEnd,
            },
          });
        }),
    );

    if (seedUser.profiles && seedUser.profiles.length > 0) {
      await db.availability.createMany({
        data: ALL_WEEK_DAYS.map((dayOfWeek) => ({
          userId: user.id,
          dayOfWeek,
          startTime: "09:00",
          endTime: "17:00",
        })),
      });
    }

    for (const profileSeed of seedUser.profiles ?? []) {
      const profile = await db.profile.create({
        data: {
          userId: user.id,
          role: profileSeed.role,
          // Matches what real onboarding persists (src/app/api/profiles/
          // [role]/route.ts) — without this, services/search.ts's province
          // filter (which reads Profile.provinceId, not User.location) has
          // nothing to match against, and every seeded provider silently
          // drops out of any province-filtered /browse search.
          provinceId: ward.provinceId,
          wardId: ward.id,
          displayName: profileSeed.displayName,
          description: profileSeed.description,
          categories: profileSeed.categories ?? [],
          priceMin: profileSeed.priceMin,
          priceMax: profileSeed.priceMax,
          address: profileSeed.address,
          area: profileSeed.area,
          amenities: profileSeed.amenities ?? [],
          shopName: profileSeed.shopName,
          height: profileSeed.height,
          measurements: profileSeed.measurements,
          hairColor: profileSeed.hairColor,
          eyeColor: profileSeed.eyeColor,
          shoeSize: profileSeed.shoeSize,
          experienceLevel: profileSeed.experienceLevel,
          travelWilling: profileSeed.travelWilling ?? false,
          isPublished: true,
        },
      });

      if (profileSeed.services && profileSeed.services.length > 0) {
        await db.service.createMany({
          data: profileSeed.services.map((service) => ({
            profileId: profile.id,
            name: service.name,
            description: service.description,
            duration: service.duration,
            price: service.price,
          })),
        });
      }
    }

    console.log(`Seeded ${seedUser.email} (${seedUser.roles.join(", ")})`);
  }

  await seedBookings();
  await seedProducts();
}

async function seedProducts() {
  const shop = await db.user.findUniqueOrThrow({
    where: { email: "shop@test.com" },
  });

  const products = [
    {
      name: "Sony A7 IV Mirrorless Camera",
      description:
        "Thân máy mirrorless full-frame 33MP, đã qua sử dụng nhẹ, tặng kèm hai pin.",
      category: "Thân máy",
      type: "SALE" as const,
      price: 45_000_000,
      condition: "LIKE_NEW" as const,
      stock: 2,
    },
    {
      name: "Canon RF 24-70mm f/2.8L Lens",
      description:
        "Ống kính zoom tiêu chuẩn, tình trạng rất tốt, không mốc không trầy.",
      category: "Ống kính",
      type: "SALE" as const,
      price: 38_000_000,
      condition: "GOOD" as const,
      stock: 1,
    },
    {
      name: "Godox AD200 Pro Flash Kit",
      description:
        "Bộ đèn flash di động kèm softbox và chân đèn. Có cho thuê theo ngày.",
      category: "Ánh sáng",
      type: "RENT" as const,
      rentalPrice: 350_000,
      depositAmount: 2_000_000,
      condition: "GOOD" as const,
      stock: 3,
    },
    {
      name: "DJI Ronin RS3 Gimbal",
      description:
        "Gimbal chống rung 3 trục cho máy ảnh mirrorless/DSLR. Bán hoặc cho thuê theo ngày.",
      category: "Phụ kiện hỗ trợ",
      type: "BOTH" as const,
      price: 12_000_000,
      rentalPrice: 500_000,
      depositAmount: 3_000_000,
      condition: "NEW" as const,
      stock: 2,
    },
    {
      name: "Rode Wireless GO II Mic Kit",
      description:
        "Bộ micro không dây cài áo nhỏ gọn, hai máy phát và một máy thu.",
      category: "Âm thanh",
      type: "SALE" as const,
      price: 5_500_000,
      condition: "NEW" as const,
      stock: 0,
    },
  ];

  for (const product of products) {
    await db.product.create({
      data: { ...product, userId: shop.id, isActive: true },
    });
  }

  console.log(`Seeded ${products.length} products for shop@test.com`);
}

async function seedBookings() {
  const [
    photographerUser,
    videographerUser,
    makeupUser,
    studioUser,
    customerUser,
  ] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { email: "photographer@test.com" } }),
    db.user.findUniqueOrThrow({ where: { email: "videographer@test.com" } }),
    db.user.findUniqueOrThrow({ where: { email: "makeup@test.com" } }),
    db.user.findUniqueOrThrow({ where: { email: "studio@test.com" } }),
    db.user.findUniqueOrThrow({ where: { email: "customer@test.com" } }),
  ]);

  const [
    portraitService,
    highlightReelService,
    bridalMakeupService,
    studioHalfDayService,
  ] = await Promise.all([
    db.service.findFirstOrThrow({
      where: {
        name: "Buổi chụp ảnh chân dung",
        profile: { userId: photographerUser.id },
      },
    }),
    db.service.findFirstOrThrow({
      where: {
        name: "Video highlight sự kiện",
        profile: { userId: videographerUser.id },
      },
    }),
    db.service.findFirstOrThrow({
      where: { name: "Trang điểm cô dâu", profile: { userId: makeupUser.id } },
    }),
    db.service.findFirstOrThrow({
      where: {
        name: "Thuê studio nửa ngày",
        profile: { userId: studioUser.id },
      },
    }),
  ]);

  const inDays = (n: number) => new Date(Date.now() + n * 86_400_000);
  const agoDays = (n: number) => new Date(Date.now() - n * 86_400_000);

  await db.booking.createMany({
    data: [
      {
        customerId: customerUser.id,
        providerId: photographerUser.id,
        serviceId: portraitService.id,
        date: inDays(5),
        startTime: "14:00",
        endTime: "15:00",
        status: "PENDING",
        totalPrice: portraitService.price,
        notes: "Chụp ngoại cảnh, ưu tiên khung giờ hoàng hôn.",
      },
      {
        customerId: customerUser.id,
        providerId: videographerUser.id,
        serviceId: highlightReelService.id,
        date: inDays(10),
        startTime: "09:00",
        endTime: "13:00",
        status: "CONFIRMED",
        totalPrice: highlightReelService.price,
      },
      {
        customerId: customerUser.id,
        providerId: makeupUser.id,
        serviceId: bridalMakeupService.id,
        date: agoDays(5),
        startTime: "07:00",
        endTime: "08:30",
        status: "COMPLETED",
        totalPrice: bridalMakeupService.price,
        completedAt: agoDays(5),
      },
      {
        customerId: customerUser.id,
        providerId: studioUser.id,
        serviceId: studioHalfDayService.id,
        date: agoDays(3),
        startTime: "10:00",
        endTime: "14:00",
        status: "CANCELLED",
        totalPrice: studioHalfDayService.price,
        cancelledBy: customerUser.id,
        cancelReason: "Trùng lịch",
      },
      {
        // Deliberately left unreviewed — exercises the "leave a review" flow
        // (the makeup-artist booking below already has a seeded review, so
        // it can only exercise respond/report, not review creation).
        customerId: customerUser.id,
        providerId: photographerUser.id,
        serviceId: portraitService.id,
        date: agoDays(10),
        startTime: "16:00",
        endTime: "17:00",
        status: "COMPLETED",
        totalPrice: portraitService.price,
        completedAt: agoDays(10),
      },
    ],
  });

  console.log("Seeded 5 bookings for customer@test.com");

  const completedBooking = await db.booking.findFirstOrThrow({
    where: {
      providerId: makeupUser.id,
      customerId: customerUser.id,
      status: "COMPLETED",
    },
  });

  await db.review.create({
    data: {
      bookingId: completedBooking.id,
      reviewerId: customerUser.id,
      reviewedId: makeupUser.id,
      rating: 5,
      content:
        "Chị Mai Hương làm mình cảm thấy rất thoải mái, lớp trang điểm giữ được cả ngày. Rất đáng để đặt lại!",
      response: "Cảm ơn Gia Bảo rất nhiều! Rất vui khi được làm việc cùng bạn.",
      respondedAt: new Date(),
    },
  });

  console.log("Seeded 1 review for makeup@test.com");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
