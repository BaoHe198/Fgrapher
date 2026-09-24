import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const repoRoot = path.resolve(__dirname, "../../..");
const read = (relativePath: string) =>
  readFileSync(path.join(repoRoot, relativePath), "utf8");

describe("Community F dùng chung bài viết nguồn", () => {
  const schema = read("prisma/schema.prisma");
  const posts = read("src/services/posts.ts");
  const albums = read("src/services/albums.ts");
  const requests = read("src/services/service-requests.ts");
  const feed = read("src/app/(public)/community/community-feed.tsx");
  const portfolio = read(
    "src/app/(public)/profile/[username]/portfolio-tab.tsx",
  );

  it("mỗi Album và ServiceRequest có tối đa một Post", () => {
    assert.match(schema, /enum PostKind\s*{[\s\S]*PORTFOLIO_ALBUM/);
    assert.match(schema, /enum PostKind\s*{[\s\S]*SERVICE_REQUEST/);
    assert.match(schema, /albumId\s+String\?\s+@unique/);
    assert.match(schema, /serviceRequestId\s+String\?\s+@unique/);
  });

  it("tạo Album và duyệt yêu cầu cùng giao dịch với việc tạo Post", () => {
    assert.match(albums, /db\.\$transaction\(async \(tx\)/);
    assert.match(albums, /kind:\s*"PORTFOLIO_ALBUM"/);

    const review = requests.slice(
      requests.indexOf("export async function reviewServiceRequest"),
      requests.indexOf("export async function listCustomerRequests"),
    );
    assert.match(review, /db\.\$transaction\(async \(tx\)/);
    assert.match(review, /kind:\s*"SERVICE_REQUEST"/);
    assert.ok(review.indexOf("tx.post.upsert") < review.indexOf("return row"));
  });

  it("Portfolio và feed dùng cùng component tương tác trên cùng postId", () => {
    assert.match(feed, /<PostEngagement[\s\S]*postId={post\.id}/);
    assert.match(
      portfolio,
      /<PostEngagement[\s\S]*postId={album\.socialPost\.id}/,
    );
  });

  it("chỉ cho tương tác với bài đang công khai", () => {
    const checks = posts.match(/AND:\s*\[PUBLIC_POST_WHERE\]/g) ?? [];
    assert.ok(
      checks.length >= 3,
      "like, add comment và list comment đều phải kiểm tra",
    );
    assert.match(posts, /status:\s*{\s*in:\s*\["OPEN",\s*"HAS_OFFERS"\]/);
    assert.match(posts, /moderationStatus:\s*"APPROVED"/);
  });

  it("feed yêu cầu không chọn hoặc trả địa chỉ chi tiết", () => {
    const selection = posts.slice(
      posts.indexOf("const FEED_SELECT"),
      posts.indexOf("type SelectedPost"),
    );
    assert.doesNotMatch(selection, /detailedAddress|areaNote/);
    assert.match(selection, /province:/);
    assert.match(selection, /ward:/);
  });
});
