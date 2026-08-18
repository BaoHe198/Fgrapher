import { PrismaClient, type ProfileCategory, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";

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
}

interface UserSeed {
  email: string;
  location: string;
  username: string;
  firstName: string;
  lastName: string;
  roles: Role[];
  profiles?: ProfileSeed[];
}

const PHOTOGRAPHER_SERVICES: ServiceSeed[] = [
  {
    name: "Wedding Photography Package",
    description: "Full-day coverage, two shooters, edited digital gallery.",
    duration: 480,
    price: 15_000_000,
  },
  {
    name: "Portrait Session",
    description:
      "One-hour studio or outdoor portrait session, 20 edited photos.",
    duration: 60,
    price: 2_000_000,
  },
];

const VIDEOGRAPHER_SERVICES: ServiceSeed[] = [
  {
    name: "Wedding Videography Package",
    description:
      "Full-day coverage with a same-day teaser and full highlight film.",
    duration: 480,
    price: 20_000_000,
  },
  {
    name: "Event Highlight Reel",
    description:
      "Half-day event coverage edited into a 3-5 minute highlight reel.",
    duration: 240,
    price: 8_000_000,
  },
];

const MAKEUP_SERVICES: ServiceSeed[] = [
  {
    name: "Bridal Makeup",
    description: "Trial session plus wedding-day makeup application.",
    duration: 90,
    price: 2_500_000,
  },
  {
    name: "Event Makeup",
    description: "Makeup application for parties, photoshoots, or events.",
    duration: 60,
    price: 1_200_000,
  },
];

const STUDIO_SERVICES: ServiceSeed[] = [
  {
    name: "Half-Day Studio Rental",
    description:
      "4-hour rental, cyclorama wall and basic lighting kit included.",
    duration: 240,
    price: 1_500_000,
  },
  {
    name: "Full-Day Studio Rental",
    description:
      "8-hour rental, cyclorama wall and basic lighting kit included.",
    duration: 480,
    price: 2_800_000,
  },
];

const USERS: UserSeed[] = [
  {
    email: "photographer@test.com",
    location: "Ho Chi Minh City",
    username: "alexrivera",
    firstName: "Alex",
    lastName: "Rivera",
    roles: ["PHOTOGRAPHER", "CUSTOMER"],
    profiles: [
      {
        role: "PHOTOGRAPHER",
        displayName: "Alex Rivera Photography",
        description:
          "Wedding and portrait photographer with 8 years of experience capturing candid, timeless moments.",
        categories: ["WEDDING", "PORTRAIT"],
        priceMin: 2_000_000,
        priceMax: 15_000_000,
        services: PHOTOGRAPHER_SERVICES,
      },
    ],
  },
  {
    email: "videographer@test.com",
    location: "Ha Noi",
    username: "jordanlee",
    firstName: "Jordan",
    lastName: "Lee",
    roles: ["VIDEOGRAPHER", "CUSTOMER"],
    profiles: [
      {
        role: "VIDEOGRAPHER",
        displayName: "Jordan Lee Films",
        description:
          "Cinematic wedding and event videographer specializing in documentary-style storytelling.",
        categories: ["WEDDING", "EVENT", "MUSIC_VIDEO"],
        priceMin: 5_000_000,
        priceMax: 25_000_000,
        services: VIDEOGRAPHER_SERVICES,
      },
    ],
  },
  {
    email: "makeup@test.com",
    location: "Da Nang",
    username: "mayachen",
    firstName: "Maya",
    lastName: "Chen",
    roles: ["MAKEUP_ARTIST", "CUSTOMER"],
    profiles: [
      {
        role: "MAKEUP_ARTIST",
        displayName: "Maya Chen Makeup",
        description:
          "Bridal and editorial makeup artist known for natural, glowing looks.",
        categories: ["BRIDAL", "NATURAL", "GLAM"],
        priceMin: 1_000_000,
        priceMax: 5_000_000,
        services: MAKEUP_SERVICES,
      },
    ],
  },
  {
    email: "studio@test.com",
    location: "Ho Chi Minh City",
    username: "taylorbrooks",
    firstName: "Taylor",
    lastName: "Brooks",
    roles: ["STUDIO", "CUSTOMER"],
    profiles: [
      {
        role: "STUDIO",
        displayName: "Brooks Creative Studio",
        description:
          "Bright, versatile studio space with a cyclorama wall and natural light, perfect for photo and video shoots.",
        categories: ["INDOOR", "CYCLORAMA", "GREEN_SCREEN"],
        priceMin: 500_000,
        priceMax: 2_800_000,
        address: "123 Nguyen Hue, District 1, Ho Chi Minh City",
        area: 120,
        amenities: ["wifi", "ac", "parking", "changing_room"],
        services: STUDIO_SERVICES,
      },
    ],
  },
  {
    email: "shop@test.com",
    location: "Ha Noi",
    username: "diazcamera",
    firstName: "Morgan",
    lastName: "Diaz",
    roles: ["CAMERA_SHOP", "CUSTOMER"],
    profiles: [
      {
        role: "CAMERA_SHOP",
        displayName: "Diaz Camera Co.",
        shopName: "Diaz Camera Co.",
        description:
          "Camera and lighting equipment rental and sales — trusted by pros since 2015.",
        // Camera shops sell via Product listings, not bookable Services.
      },
    ],
  },
  {
    email: "customer@test.com",
    location: "Ho Chi Minh City",
    username: "caseynguyen",
    firstName: "Casey",
    lastName: "Nguyen",
    roles: ["CUSTOMER"],
  },
  {
    email: "multi@test.com",
    location: "Da Lat",
    username: "jamiekim",
    firstName: "Jamie",
    lastName: "Kim",
    roles: ["PHOTOGRAPHER", "VIDEOGRAPHER", "CUSTOMER"],
    profiles: [
      {
        role: "PHOTOGRAPHER",
        displayName: "Jamie Kim Photography",
        description:
          "Freelance photographer covering weddings, events, and portraits.",
        categories: ["WEDDING", "PORTRAIT", "EVENT"],
        priceMin: 1_500_000,
        priceMax: 10_000_000,
        services: PHOTOGRAPHER_SERVICES,
      },
      {
        role: "VIDEOGRAPHER",
        displayName: "Jamie Kim Films",
        description:
          "Same-day edit videography for weddings and corporate events.",
        categories: ["WEDDING", "CORPORATE"],
        priceMin: 4_000_000,
        priceMax: 18_000_000,
        services: VIDEOGRAPHER_SERVICES,
      },
    ],
  },
];

const WEEKDAYS = [1, 2, 3, 4, 5]; // Mon-Fri (0=Sunday, 6=Saturday)

async function main() {
  const emails = USERS.map((u) => u.email);

  const existing = await db.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  if (existing.length > 0) {
    const existingIds = existing.map((u) => u.id);

    // Availability has no FK relation to User in the schema, so it isn't
    // covered by cascade delete — clean it up explicitly before removing users.
    await db.availability.deleteMany({ where: { userId: { in: existingIds } } });

    // Same story for Review -> Booking, and Booking.customer/provider have
    // no onDelete: Cascade (a Restrict FK by default) — delete reviews then
    // bookings referencing these seed users first, or the user delete below
    // fails with a foreign key constraint violation.
    await db.review.deleteMany({
      where: { OR: [{ reviewerId: { in: existingIds } }, { reviewedId: { in: existingIds } }] },
    });
    await db.booking.deleteMany({
      where: { OR: [{ customerId: { in: existingIds } }, { providerId: { in: existingIds } }] },
    });

    await db.user.deleteMany({ where: { id: { in: existingIds } } });
  }

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);

  for (const seedUser of USERS) {
    const user = await db.user.create({
      data: {
        email: seedUser.email,
        username: seedUser.username,
        location: seedUser.location,
        firstName: seedUser.firstName,
        lastName: seedUser.lastName,
        name: `${seedUser.firstName} ${seedUser.lastName}`,
        passwordHash,
        emailVerified: new Date(),
      },
    });

    await db.userRole.createMany({
      data: seedUser.roles.map((role) => ({
        userId: user.id,
        role,
        active: true,
      })),
    });

    if (seedUser.profiles && seedUser.profiles.length > 0) {
      await db.availability.createMany({
        data: WEEKDAYS.map((dayOfWeek) => ({
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
          displayName: profileSeed.displayName,
          description: profileSeed.description,
          categories: profileSeed.categories ?? [],
          priceMin: profileSeed.priceMin,
          priceMax: profileSeed.priceMax,
          address: profileSeed.address,
          area: profileSeed.area,
          amenities: profileSeed.amenities ?? [],
          shopName: profileSeed.shopName,
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
}

async function seedBookings() {
  const [photographerUser, videographerUser, makeupUser, studioUser, customerUser] =
    await Promise.all([
      db.user.findUniqueOrThrow({ where: { email: "photographer@test.com" } }),
      db.user.findUniqueOrThrow({ where: { email: "videographer@test.com" } }),
      db.user.findUniqueOrThrow({ where: { email: "makeup@test.com" } }),
      db.user.findUniqueOrThrow({ where: { email: "studio@test.com" } }),
      db.user.findUniqueOrThrow({ where: { email: "customer@test.com" } }),
    ]);

  const [portraitService, highlightReelService, bridalMakeupService, studioHalfDayService] =
    await Promise.all([
      db.service.findFirstOrThrow({
        where: { name: "Portrait Session", profile: { userId: photographerUser.id } },
      }),
      db.service.findFirstOrThrow({
        where: { name: "Event Highlight Reel", profile: { userId: videographerUser.id } },
      }),
      db.service.findFirstOrThrow({
        where: { name: "Bridal Makeup", profile: { userId: makeupUser.id } },
      }),
      db.service.findFirstOrThrow({
        where: { name: "Half-Day Studio Rental", profile: { userId: studioUser.id } },
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
        notes: "Outdoor portrait session, golden hour preferred.",
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
        cancelReason: "Schedule conflict",
      },
    ],
  });

  console.log("Seeded 4 bookings for customer@test.com");

  const completedBooking = await db.booking.findFirstOrThrow({
    where: { providerId: makeupUser.id, customerId: customerUser.id, status: "COMPLETED" },
  });

  await db.review.create({
    data: {
      bookingId: completedBooking.id,
      reviewerId: customerUser.id,
      reviewedId: makeupUser.id,
      rating: 5,
      content: "Maya made me feel so comfortable and the makeup lasted all day. Highly recommend!",
      response: "Thank you so much, Casey! It was a pleasure working with you.",
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
