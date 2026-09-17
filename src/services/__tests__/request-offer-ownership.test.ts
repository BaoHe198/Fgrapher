import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import type { ServiceRequest } from "@prisma/client";

import {
  OfferError,
  OfferNotFoundError,
  OwnRequestOfferError,
  assertProviderMayOffer,
} from "@/services/request-offers";

const openRequest = {
  customerId: "customer_1",
  isDraft: false,
  role: "PHOTOGRAPHER",
  status: "OPEN",
} satisfies Pick<ServiceRequest, "customerId" | "isDraft" | "role" | "status">;

describe("quyền gửi đề nghị cho yêu cầu dịch vụ", () => {
  it("từ chối provider chính là người đăng yêu cầu", () => {
    assert.throws(
      () => assertProviderMayOffer(openRequest, "customer_1", "PHOTOGRAPHER"),
      (error: unknown) =>
        error instanceof OwnRequestOfferError && error.status === 403,
    );
  });

  it("cho phép provider khác gửi đề nghị cho yêu cầu đang mở", () => {
    assert.doesNotThrow(() =>
      assertProviderMayOffer(openRequest, "provider_2", "PHOTOGRAPHER"),
    );
  });

  it("ẩn yêu cầu nháp hoặc sai vai trò như một tài nguyên không tồn tại", () => {
    assert.throws(
      () =>
        assertProviderMayOffer(
          { ...openRequest, isDraft: true },
          "provider_2",
          "PHOTOGRAPHER",
        ),
      OfferNotFoundError,
    );
    assert.throws(
      () => assertProviderMayOffer(openRequest, "provider_2", "VIDEOGRAPHER"),
      OfferNotFoundError,
    );
  });

  it("từ chối yêu cầu đã đóng", () => {
    assert.throws(
      () =>
        assertProviderMayOffer(
          { ...openRequest, status: "FULFILLED" },
          "provider_2",
          "PHOTOGRAPHER",
        ),
      (error: unknown) => error instanceof OfferError && error.status === 400,
    );
  });
});

// These checks pin the read paths too. The owner must not receive or act on
// their request as a provider, while the system-wide browse remains complete
// and sends the owner to customer management instead.
describe("phân biệt yêu cầu của chính mình trong các luồng provider", () => {
  const repoRoot = path.resolve(__dirname, "../../..");
  const offerService = readFileSync(
    path.join(repoRoot, "src/services/request-offers.ts"),
    "utf8",
  );
  const browseService = readFileSync(
    path.join(repoRoot, "src/services/service-requests.ts"),
    "utf8",
  );

  it("loại chủ yêu cầu khỏi thông báo và danh sách phù hợp", () => {
    assert.match(offerService, /userId:\s*{\s*not:\s*request\.customerId\s*}/);
    assert.match(offerService, /customerId:\s*{\s*not:\s*userId\s*}/);
  });

  it("chặn URL chi tiết trực tiếp trước khi ghi audit", () => {
    const ownerGuard = offerService.indexOf(
      "if (request.customerId === providerId) throw new OfferNotFoundError()",
    );
    const auditWrite = offerService.indexOf("await logAudit", ownerGuard);
    assert.ok(ownerGuard >= 0, "missing detail ownership guard");
    assert.ok(auditWrite > ownerGuard, "ownership guard must run before audit");
  });

  it("vẫn hiện yêu cầu của chủ trong danh sách chung và đánh dấu quyền sở hữu", () => {
    const browseStart = browseService.indexOf(
      "export async function listBrowsableRequests",
    );
    const browseEnd = browseService.indexOf(
      "export async function listUnclaimedRequests",
      browseStart,
    );
    const browseFunction = browseService.slice(browseStart, browseEnd);

    assert.doesNotMatch(
      browseFunction,
      /customerId:\s*{\s*not:\s*viewerId\s*}/,
    );
    assert.match(browseFunction, /isOwner:\s*customerId === viewerId/);
  });

  it("danh sách chung chỉ trả các trường cần cho thẻ, không lộ địa chỉ chi tiết", () => {
    const browseStart = browseService.indexOf(
      "export async function listBrowsableRequests",
    );
    const browseEnd = browseService.indexOf(
      "export async function listUnclaimedRequests",
      browseStart,
    );
    const browseFunction = browseService.slice(browseStart, browseEnd);

    assert.match(browseFunction, /select:\s*{/);
    assert.doesNotMatch(browseFunction, /detailedAddress/);
  });
});
