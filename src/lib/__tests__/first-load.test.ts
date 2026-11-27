import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

// What a page's first load must not quietly grow back into. Each of these
// was measured on 27/11/2026 (docs/reviews/performance-test-2026-11-27.md);
// the checks read the source because the cost only shows in a browser.

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");
const codeOnly = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

describe("bộ báo lỗi không nằm trong lượt tải đầu của trang", () => {
  const browserEntries = [
    "src/instrumentation-client.ts",
    "src/app/error.tsx",
    "src/app/global-error.tsx",
    "src/lib/sentry-client.ts",
  ];

  for (const file of browserEntries) {
    it(`${file} không import thẳng SDK`, () => {
      assert.doesNotMatch(
        codeOnly(read(file)),
        /from\s+["']@sentry\/nextjs["']/,
        `${file} import "@sentry/nextjs" trực tiếp: cả SDK (khoảng 76 KB nén) ` +
          "sẽ quay lại lượt tải đầu của mọi trang. Dùng reportError() trong " +
          "lib/sentry-client.ts.",
      );
    });
  }

  it("SDK chỉ được nạp bằng import() và chỉ khi có DSN", () => {
    const client = codeOnly(read("src/lib/sentry-client.ts"));
    assert.match(client, /if \(!dsn\) return Promise\.resolve\(null\)/);
    assert.match(client, /import\(\s*["']@\/lib\/sentry-client-sdk["']\s*\)/);
  });

  it("lỗi xảy ra trước khi SDK về vẫn được giữ lại để báo", () => {
    const client = codeOnly(read("src/lib/sentry-client.ts"));
    assert.match(client, /addEventListener\("error", onError\)/);
    assert.match(
      client,
      /addEventListener\("unhandledrejection", onRejection\)/,
    );
    assert.match(
      client,
      /for \(const error of early\) module\.captureException/,
    );
  });
});

describe("thứ lớn nhất trên màn hình đầu được vẽ sớm", () => {
  it("khung cookie nằm trước nội dung trang trong layout gốc", () => {
    const layout = codeOnly(read("src/app/layout.tsx"));
    const banner = layout.indexOf("<CookieConsentBanner");
    const page = layout.indexOf("{children}");
    assert.ok(banner !== -1 && page !== -1);
    assert.ok(
      banner < page,
      "Khung cookie phải đứng trước {children}: ở cuối tệp HTML nó là thứ được " +
        "vẽ sau cùng trên điện thoại mạng chậm.",
    );
  });

  it("ảnh chính của trang được tải với mức ưu tiên cao, không dùng `priority` cũ", () => {
    const fgImage = codeOnly(read("src/components/ui/fg-image.tsx"));
    assert.match(fgImage, /fetchPriority=\{priority \? "high" : "auto"\}/);
    assert.match(fgImage, /loading=\{priority \? "eager" : "lazy"\}/);
    assert.doesNotMatch(fgImage, /\bpriority=\{priority\}/);

    const hero = codeOnly(
      read("src/app/(public)/profile/[username]/profile-hero.tsx"),
    );
    assert.match(hero, /fetchPriority="high"/);
  });
});

describe("mã chỉ dành cho người đã đăng nhập được tách khỏi gói tải đầu", () => {
  it("hộp tin nhắn là một tệp riêng, nạp khi rảnh hoặc khi mở", () => {
    const provider = codeOnly(
      read("src/components/providers/messaging-provider.tsx"),
    );
    assert.match(provider, /const MessagingPopup = dynamic\(/);
    assert.doesNotMatch(
      provider,
      /import \{ MessagingPopup \} from/,
      "Import thẳng MessagingPopup đưa cả khung chat vào lượt tải đầu của mọi khách.",
    );
    assert.match(
      provider,
      /status === "authenticated" && \(isOpen \|\| idle\)/,
    );
  });

  it("chuông và giỏ hàng trên thanh đầu trang là tệp riêng", () => {
    const nav = codeOnly(read("src/components/layout/web-nav.tsx"));
    assert.match(nav, /const NotificationBell = dynamic\(/);
    assert.match(nav, /const CartDrawer = dynamic\(/);
    assert.doesNotMatch(nav, /import \{ (NotificationBell|CartDrawer) \} from/);
  });

  it("bản đồ F chỉ khởi động khi phần còn lại của trang đã rảnh", () => {
    const fmap = codeOnly(read("src/app/(public)/fmap/fmap-client.tsx"));
    assert.match(fmap, /const mapWanted = useIdleReady\(\)/);
    assert.match(fmap, /\{mapWanted \? \(\s*<FmapMap/);
  });
});

describe("màn hình có dữ liệu ngay trong lượt tải đầu", () => {
  it("chi tiết lịch đặt: trang đọc bằng đúng cổng và đúng hàm của API", () => {
    const page = codeOnly(
      read("src/app/(dashboard)/dashboard/bookings/[id]/page.tsx"),
    );
    assert.doesNotMatch(page, /["']use client["']/);
    assert.match(page, /await sessionForPage\(\)/);
    assert.match(page, /getBookingDetail\(id, session\.user\.id\)/);
    assert.match(page, /key=\{id\}/);

    const client = codeOnly(
      read(
        "src/app/(dashboard)/dashboard/bookings/[id]/booking-detail-client.tsx",
      ),
    );
    assert.match(client, /useState<BookingDetail \| null>\(initialBooking\)/);
    assert.doesNotMatch(
      client,
      /useEffect\(\(\) => \{\s*load\(\);/,
      "Màn hình lại tự tải lịch đặt khi mở: đó là lượt hỏi máy chủ thứ hai mà trang đã bỏ.",
    );
  });

  it("ba trang quản trị kiểm tra quyền quản trị trước khi đọc dữ liệu", () => {
    for (const [file, reader] of [
      ["src/app/(admin)/admin/users/page.tsx", "listAdminUsers"],
      ["src/app/(admin)/admin/reports/page.tsx", "listReports"],
      ["src/app/(admin)/admin/compliance/page.tsx", "listDataRequests"],
    ] as const) {
      const page = codeOnly(read(file));
      const gate = page.indexOf("await adminSessionForPage()");
      const data = page.indexOf(`await ${reader}(`);
      assert.ok(gate !== -1, `${file} thiếu adminSessionForPage()`);
      assert.ok(data !== -1, `${file} không đọc bằng ${reader}`);
      assert.ok(gate < data, `${file} đọc dữ liệu trước khi kiểm tra quyền`);
      assert.match(
        page,
        /if \(!\(await adminSessionForPage\(\)\)\) return null;/,
      );
    }
  });
});
