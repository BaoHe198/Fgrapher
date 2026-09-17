import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const repoRoot = path.resolve(__dirname, "../../..");
const read = (relativePath: string) =>
  readFileSync(path.join(repoRoot, relativePath), "utf8");

describe("kiểm duyệt yêu cầu trước khi công khai", () => {
  const schema = read("prisma/schema.prisma");
  const service = read("src/services/service-requests.ts");
  const offerService = read("src/services/request-offers.ts");

  it("có trạng thái chờ duyệt và bị từ chối trong schema", () => {
    assert.match(schema, /enum ServiceRequestStatus\s*{[\s\S]*PENDING_REVIEW/);
    assert.match(schema, /enum ServiceRequestStatus\s*{[\s\S]*REJECTED/);
    assert.match(
      schema,
      /status\s+ServiceRequestStatus\s+@default\(PENDING_REVIEW\)/,
    );
  });

  it("tạo mới và đăng bản nháp đều đi vào hàng chờ", () => {
    assert.match(
      service,
      /status:\s*input\.isDraft\s*\?\s*"OPEN"\s*:\s*"PENDING_REVIEW"/,
    );
    const publishStart = service.indexOf(
      "export async function publishDraftServiceRequest",
    );
    const reviewStart = service.indexOf(
      "export async function reviewServiceRequest",
    );
    assert.match(
      service.slice(publishStart, reviewStart),
      /status:\s*"PENDING_REVIEW"/,
    );
  });

  it("chỉ admin approval mới mở yêu cầu và bắt đầu lại hạn 7 ngày", () => {
    const reviewStart = service.indexOf(
      "export async function reviewServiceRequest",
    );
    const listStart = service.indexOf(
      "export async function listCustomerRequests",
    );
    const review = service.slice(reviewStart, listStart);
    assert.match(review, /status:\s*"PENDING_REVIEW"/);
    assert.match(review, /status:\s*"OPEN"/);
    assert.match(review, /REQUEST_TTL_DAYS/);
    assert.match(review, /status:\s*"REJECTED"/);
    assert.match(review, /moderationReason:\s*reason/);
  });

  it("danh sách công khai và feed provider chỉ đọc yêu cầu đã mở", () => {
    assert.match(service, /status:\s*{\s*in:\s*OPEN_STATUSES\s*}/);
    assert.match(
      offerService,
      /status:\s*{\s*in:\s*\["OPEN",\s*"HAS_OFFERS"\]\s*}/,
    );
  });

  it("API duyệt bắt buộc quyền admin", () => {
    const route = read("src/app/api/admin/service-requests/[id]/route.ts");
    assert.match(route, /await requireAdmin\(\)/);
    assert.match(route, /reviewServiceRequestSchema\.safeParse/);
    assert.match(route, /await logAdminAction\(/);
  });
});
