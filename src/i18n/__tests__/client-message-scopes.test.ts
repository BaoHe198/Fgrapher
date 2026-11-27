import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { CLIENT_MESSAGE_SCOPES } from "@/i18n/client-message-scopes.generated";
import {
  mergeMessages,
  pickMessages,
  type MessageTree,
} from "@/i18n/pick-messages";

import {
  computeClientMessageScopes,
  SCOPE_DIRS,
} from "../../../scripts/gen-client-message-scopes.mjs";

const ROOT = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");

describe("câu chữ gửi cho trình duyệt theo từng khu vực", () => {
  const computed = computeClientMessageScopes(ROOT);

  it("tệp sinh ra khớp với mã nguồn hiện tại", () => {
    assert.deepEqual(
      computed.scopes,
      CLIENT_MESSAGE_SCOPES,
      "src/i18n/client-message-scopes.generated.ts đã cũ: một Client Component " +
        "gọi useTranslations() với nhóm câu chữ chưa có trong danh sách, nên trên " +
        "trang sẽ hiện tên khóa thay cho câu chữ. Chạy `pnpm i18n:scopes` rồi " +
        "commit tệp đó.",
    );
  });

  it("mã chạy trên trình duyệt luôn ghi rõ nhóm câu chữ bằng chuỗi cố định", () => {
    assert.deepEqual(
      computed.problems,
      [],
      "useTranslations() không tham số, hoặc với tên nhóm tính toán, thì không " +
        'biết trước cần gửi nhóm nào. Viết useTranslations("a.b").',
    );
  });

  it("layout của mỗi khu vực bọc đúng phần câu chữ của khu vực đó", () => {
    for (const [scope, dir] of Object.entries(SCOPE_DIRS)) {
      assert.ok(
        read(`${dir}/layout.tsx`).includes(`<ScopedMessages scope="${scope}">`),
        `${dir}/layout.tsx phải bọc nội dung trong <ScopedMessages scope="${scope}">`,
      );
    }
    assert.deepEqual(
      Object.keys(CLIENT_MESSAGE_SCOPES).sort(),
      ["root", ...Object.keys(SCOPE_DIRS)].sort(),
    );
  });

  it("layout gốc chỉ gửi phần mọi trang đều cần, không gửi cả bảng", () => {
    const layout = read("src/app/layout.tsx");
    assert.ok(layout.includes("CLIENT_MESSAGE_SCOPES.root"));
    assert.ok(!/messages=\{\s*await getMessages\(\)\s*\}/.test(layout));
  });

  it("mọi nhóm trong danh sách đều có trong cả bảng tiếng Việt và tiếng Anh", () => {
    for (const locale of ["vi", "en"]) {
      const catalogue = JSON.parse(
        read(`src/messages/${locale}.json`),
      ) as MessageTree;
      for (const [scope, namespaces] of Object.entries(CLIENT_MESSAGE_SCOPES)) {
        for (const namespace of namespaces) {
          let node: MessageTree | string | undefined = catalogue;
          for (const key of namespace.split(".")) {
            node = typeof node === "object" ? node[key] : undefined;
          }
          assert.notEqual(
            node,
            undefined,
            `${locale}.json thiếu "${namespace}" (khu vực ${scope})`,
          );
        }
      }
    }
  });

  it("khu vực công khai không kéo theo câu chữ của trang quản trị", () => {
    const publicScope: readonly string[] = CLIENT_MESSAGE_SCOPES.public;
    assert.deepEqual(
      publicScope.filter((n) => n.startsWith("accountFlows.admin")),
      [],
    );
  });
});

describe("cắt và ghép bảng câu chữ", () => {
  const all: MessageTree = {
    nav: { home: "Trang chủ", browse: "Tìm kiếm" },
    shared: {
      toast: { close: "Đóng" },
      bell: { title: "Thông báo", empty: "Chưa có thông báo" },
    },
    admin: { users: { title: "Người dùng" } },
  };

  it("chỉ giữ các nhóm được nêu tên, đúng hình dạng của bảng gốc", () => {
    assert.deepEqual(pickMessages(all, ["nav", "shared.bell"]), {
      nav: { home: "Trang chủ", browse: "Tìm kiếm" },
      shared: { bell: { title: "Thông báo", empty: "Chưa có thông báo" } },
    });
  });

  it("hai nhóm chung một nhánh cha nằm cạnh nhau, không đè nhau", () => {
    assert.deepEqual(pickMessages(all, ["shared.toast", "shared.bell"]), {
      shared: all.shared,
    });
  });

  it("nhóm không có trong bảng thì bỏ qua, không dựng nhánh rỗng", () => {
    assert.deepEqual(pickMessages(all, ["nav.home.deeper", "missing.x"]), {});
  });

  it("không sửa bảng gốc", () => {
    const before = JSON.stringify(all);
    pickMessages(all, ["shared.bell", "admin.users"]);
    assert.equal(JSON.stringify(all), before);
  });

  it("ghép phần gốc với phần của khu vực, giữ cả hai", () => {
    const root = pickMessages(all, ["shared.toast"]);
    const area = pickMessages(all, ["shared.bell", "nav"]);
    const rootBefore = JSON.stringify(root);
    assert.deepEqual(mergeMessages(root, area), {
      nav: all.nav,
      shared: all.shared,
    });
    assert.equal(JSON.stringify(root), rootBefore, "phần gốc không bị sửa");
  });
});
