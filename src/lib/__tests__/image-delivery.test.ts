import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  DELIVERY_WIDTHS,
  MAP_MARKER_DELIVERY_SIZE,
  buildMediaVariants,
  buildSizedMediaUrl,
  buildSquareThumbUrl,
  deliveryWidthFor,
} from "@/lib/media/variants";

// An uploaded photo is stored at the size it was uploaded. Drawn through
// next/image it is resized on the way; drawn with a plain <img> it is not,
// and the browser downloads the whole upload for a tile of a few dozen
// pixels. Measured 27/11/2026 on the live home page: 300 KB for the 44px
// photo frame of one map marker, under 2 KB at the size it is drawn
// (docs/reviews/performance-test-2026-11-27.md, section 11).

const ORIGINAL =
  "https://res.cloudinary.com/demo/image/upload/v1789642854/fgrapher/portfolio/abc/photo.jpg";

describe("ảnh vuông nhỏ cho ô ảnh trên bản đồ", () => {
  it("ảnh gốc được cắt vuông, thu nhỏ và đổi sang WebP", () => {
    assert.equal(
      buildSquareThumbUrl(ORIGINAL, MAP_MARKER_DELIVERY_SIZE),
      `https://res.cloudinary.com/demo/image/upload/c_fill,w_${MAP_MARKER_DELIVERY_SIZE},h_${MAP_MARKER_DELIVERY_SIZE},f_webp,q_auto/v1789642854/fgrapher/portfolio/abc/photo.jpg`,
    );
  });

  it("ô ảnh 44px đủ nét trên điện thoại 3x", () => {
    assert.ok(MAP_MARKER_DELIVERY_SIZE >= 44 * 3);
    assert.ok(
      MAP_MARKER_DELIVERY_SIZE <= 200,
      "Ô ảnh chỉ 44px: xin ảnh lớn hơn là tải thừa.",
    );
  });

  it("địa chỉ đã có phép biến đổi thì giữ nguyên, không chồng thêm", () => {
    const transformed =
      "https://res.cloudinary.com/demo/image/upload/c_limit,w_400,f_webp,q_auto/v1/fgrapher/portfolio/x.jpg";
    assert.equal(buildSquareThumbUrl(transformed, 132), transformed);
  });

  it("ảnh ngoài Cloudinary, ảnh xem trước và video thì giữ nguyên", () => {
    for (const url of [
      "https://lh3.googleusercontent.com/a/ACg8ocK=s96-c",
      "blob:http://localhost:3000/3f1c7a52-0d8e-4c0b-9d0a-6c1b5a2e9f11",
      "/images/showcase/roles/studio.jpg",
      "https://res.cloudinary.com/demo/video/upload/v1/fgrapher/clip.mp4",
    ]) {
      assert.equal(buildSquareThumbUrl(url, 132), url, url);
    }
  });
});

const ROOT = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");
// Comments out, code kept. Only a JSX comment or a block comment that starts
// its line is treated as one: `accept="image/*"` in an upload field is not
// the start of a comment, and reading it as one swallowed the code after it
// (and the <img> this file exists to find).
const codeOnly = (source: string) =>
  source
    .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "")
    .replace(/\{\s*\/\*(?:(?!\*\/)[\s\S])*\*\/\s*\}/g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

function tsxFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(path.join(ROOT, dir), {
    withFileTypes: true,
  })) {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__") found.push(...tsxFiles(relative));
    } else if (entry.name.endsWith(".tsx")) {
      found.push(relative);
    }
  }
  return found;
}

// A plain <img> whose picture is not an uploaded photo, or must not be
// resized. Add a file here only with the reason.
const PLAIN_IMG_ALLOWED: Record<string, string> = {
  "src/app/(admin)/admin/verifications/page.tsx":
    "giấy tờ tùy thân: đường dẫn ký ngắn hạn, không được qua bộ tối ưu hay biến đổi ảnh",
  "src/app/onboarding/verification/verification-form.tsx":
    "ảnh xem trước của tệp vừa chọn trên máy (blob:)",
  "src/components/modals/upload-media-modal.tsx":
    "ảnh xem trước của tệp vừa chọn trên máy (blob:)",
  "src/app/(dashboard)/dashboard/share/share-client.tsx":
    "mã QR dựng trong trình duyệt (data:)",
  "src/components/profile/qr-code-dialog.tsx":
    "mã QR dựng trong trình duyệt (data:)",
  "src/components/media/portfolio-video.tsx":
    "ảnh bìa video: ảnh thu nhỏ của YouTube hoặc khung hình Cloudinary đã thu nhỏ",
};

const SIZED = /\b(buildMediaVariants|buildSquareThumbUrl|buildAvatarUrl)\(/;

describe("ảnh người dùng tải lên không bao giờ được vẽ ở kích thước gốc", () => {
  const files = tsxFiles("src");

  it("mọi thẻ <img> thường đều xin bản đã thu nhỏ", () => {
    const offenders: string[] = [];
    for (const file of files) {
      if (PLAIN_IMG_ALLOWED[file]) continue;
      const source = codeOnly(read(file));
      for (const tag of source.match(/<img\b[\s\S]*?\/>/g) ?? []) {
        if (!SIZED.test(tag)) {
          offenders.push(`${file}: ${tag.replace(/\s+/g, " ").slice(0, 90)}`);
        }
      }
    }
    assert.deepEqual(
      offenders,
      [],
      "Thẻ <img> đưa thẳng địa chỉ ảnh: trình duyệt sẽ tải ảnh ở kích thước " +
        "gốc. Dùng buildMediaVariants(url).thumbnail (hoặc .medium), " +
        "buildSquareThumbUrl cho ô ảnh vuông nhỏ, hay <FgImage>.",
    );
  });

  it("danh sách ngoại lệ không giữ tệp đã hết thẻ <img>", () => {
    for (const file of Object.keys(PLAIN_IMG_ALLOWED)) {
      assert.ok(
        /<img\b/.test(codeOnly(read(file))),
        `${file} không còn thẻ <img>: bỏ nó khỏi danh sách ngoại lệ.`,
      );
    }
  });

  it("ô ảnh của điểm trên Bản đồ F (dựng ngoài React) cũng vậy", () => {
    const map = codeOnly(read("src/components/fmap/fmap-map.tsx"));
    assert.match(
      map,
      /image\.src = buildSquareThumbUrl\(photo, MAP_MARKER_DELIVERY_SIZE\)/,
    );
    assert.doesNotMatch(map, /image\.src = photo;/);
  });

  it("ảnh bìa chủ tài khoản tự xem không phải ảnh gốc", () => {
    const hero = codeOnly(
      read("src/app/(public)/profile/[username]/profile-hero.tsx"),
    );
    assert.match(hero, /buildMediaVariants\(displayCover\)\.large/);
    const settings = codeOnly(
      read("src/app/(dashboard)/dashboard/settings/profile/account-media.tsx"),
    );
    assert.match(settings, /<CloudinaryImage\s+src=\{coverImage\}/);
  });
});

describe("ảnh được tải ở độ rộng vừa với màn hình", () => {
  it("chọn bản nhỏ nhất đủ che ô ảnh", () => {
    // The widths next/image asks its loader for (imageSizes + deviceSizes).
    assert.deepEqual(
      [32, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840].map((w) =>
        deliveryWidthFor(w),
      ),
      [400, 400, 400, 800, 800, 800, 1200, 1200, 2000, 2000, 2000],
    );
  });

  it("bản hẹp hơn ô ảnh dưới 10% vẫn được coi là đủ", () => {
    // 412px ở 2x = 824 điểm ảnh, cỡ Android phổ biến nhất: nhận bản 800.
    assert.equal(deliveryWidthFor(828), 800);
    assert.equal(deliveryWidthFor(888), 800);
    assert.equal(deliveryWidthFor(890), 1200);
    assert.equal(deliveryWidthFor(444), 400);
    assert.equal(deliveryWidthFor(445), 800);
  });

  it("không bao giờ vượt mức trần của ô ảnh", () => {
    assert.equal(deliveryWidthFor(3840, 1200), 1200);
    assert.equal(deliveryWidthFor(1080, 800), 800);
    assert.equal(deliveryWidthFor(640, 400), 400);
    assert.equal(deliveryWidthFor(300, 1200), 400);
  });

  it("chỉ có bốn độ rộng, để máy chủ ảnh không phải giữ quá nhiều bản", () => {
    assert.deepEqual([...DELIVERY_WIDTHS], [400, 800, 1200, 2000]);
    const widths = new Set<string>();
    for (let w = 16; w <= 3840; w += 8) {
      widths.add(buildSizedMediaUrl(ORIGINAL, w));
    }
    assert.equal(widths.size, 4);
  });

  it("địa chỉ trả về trùng với bản thumbnail, medium, large đã có", () => {
    const variants = buildMediaVariants(ORIGINAL);
    assert.equal(buildSizedMediaUrl(ORIGINAL, 400), variants.thumbnail);
    assert.equal(buildSizedMediaUrl(ORIGINAL, 1200), variants.medium);
    assert.equal(buildSizedMediaUrl(ORIGINAL, 2000), variants.large);
    assert.equal(
      buildSizedMediaUrl(ORIGINAL, 750),
      "https://res.cloudinary.com/demo/image/upload/c_limit,w_800,f_webp,q_auto/v1789642854/fgrapher/portfolio/abc/photo.jpg",
    );
  });

  it("ảnh không nằm trên Cloudinary thì giữ nguyên", () => {
    for (const url of [
      "/images/showcase/roles/studio.jpg",
      "blob:http://localhost:3000/3f1c7a52-0d8e-4c0b-9d0a-6c1b5a2e9f11",
      "https://images.unsplash.com/photo-1?w=800",
    ]) {
      assert.equal(buildSizedMediaUrl(url, 640), url, url);
    }
  });

  it("không ảnh nào bỏ qua bộ tối ưu mà lại xin một cỡ lớn cố định", () => {
    const offenders: string[] = [];
    for (const file of tsxFiles("src")) {
      const source = codeOnly(read(file));
      for (const tag of source.match(/<Image\b[\s\S]*?\/>/g) ?? []) {
        if (
          /\sunoptimized(\s|\/)/.test(tag) &&
          /buildMediaVariants\([^)]*\)\.(medium|large)/.test(tag)
        ) {
          offenders.push(file);
        }
      }
    }
    assert.deepEqual(
      offenders,
      [],
      "`unoptimized` cùng với .medium hay .large gửi một cỡ ảnh cho mọi màn " +
        "hình (1200 hay 2000 điểm ảnh cho cả một ô 200px). Dùng " +
        "<CloudinaryImage src={url} sizes=…> để trình duyệt chọn cỡ.",
    );
  });

  it("CloudinaryImage luôn đi kèm `sizes`, trừ ảnh có kích thước cố định", () => {
    const offenders: string[] = [];
    for (const file of tsxFiles("src")) {
      const source = codeOnly(read(file));
      for (const tag of source.match(/<CloudinaryImage\b[\s\S]*?\/>/g) ?? []) {
        if (!/\ssizes=/.test(tag)) offenders.push(file);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      "Thiếu `sizes` thì trình duyệt coi ảnh rộng bằng cả màn hình và tải bản " +
        "lớn nhất.",
    );
  });
});

describe("ảnh trên màn hình đầu được tải trước mã của trang", () => {
  it("không thẻ next/image nào dùng `priority` cũ", () => {
    const offenders: string[] = [];
    for (const file of tsxFiles("src")) {
      const source = codeOnly(read(file));
      for (const tag of source.match(/<Image\b[\s\S]*?\/>/g) ?? []) {
        if (/\spriority(=|\s|\/)/.test(tag)) offenders.push(file);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      "Từ Next 16, `priority` của next/image chỉ thêm thẻ preload, không đặt " +
        "mức ưu tiên tải: ảnh vẫn xếp hàng sau mã JavaScript. Dùng " +
        '`loading="eager" fetchPriority="high"`, hoặc <FgImage priority>.',
    );
  });

  it("thẻ nghệ sĩ đầu trang Tìm kiếm F và trang theo tỉnh xin ảnh với mức ưu tiên cao", () => {
    const browseCard = codeOnly(
      read("src/components/browse/browse-artist-card.tsx"),
    );
    assert.match(browseCard, /fetchPriority=\{eager \? "high" : "auto"\}/);

    const card = codeOnly(read("src/components/cards/artist-card.tsx"));
    assert.match(card, /fetchPriority=\{priority \? "high" : "auto"\}/);
    assert.match(card, /loading=\{priority \? "eager" : "lazy"\}/);

    const province = codeOnly(
      read("src/app/(public)/[roleSlug]/[provinceSlug]/page.tsx"),
    );
    assert.match(
      province,
      /priority=\{index < 2\}/,
      "Ảnh thẻ đầu tiên là thứ lớn nhất trên màn hình đầu của trang theo tỉnh; " +
        "để lazy thì nó chờ sau mã của trang.",
    );
  });
});

describe("bản đồ nhỏ chỉ khởi động khi người xem cuộn tới gần", () => {
  for (const [file, component] of [
    ["src/components/profile/service-area-map-lazy.tsx", "ServiceAreaMap"],
    ["src/components/places/place-mini-map-lazy.tsx", "PlaceMiniMap"],
  ] as const) {
    it(`${file} chờ useNearViewport rồi mới dựng bản đồ`, () => {
      const source = codeOnly(read(file));
      assert.match(source, /const \[ref, near\] = useNearViewport</);
      assert.match(source, new RegExp(`const ${component} = dynamic\\(`));
      assert.doesNotMatch(
        source,
        new RegExp(`export const ${component}Lazy = dynamic\\(`),
        "Xuất thẳng thành phần dynamic làm bộ máy bản đồ (khoảng 280 KB mã) " +
          "tải ngay khi mở trang, dù bản đồ nằm tận phía dưới.",
      );
    });
  }
});
