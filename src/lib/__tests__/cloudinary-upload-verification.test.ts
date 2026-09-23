import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isValidPortfolioAsset } from "@/lib/cloudinary";

const input = {
  publicId: "fgrapher/portfolio/user-1/photo",
  url: "https://res.cloudinary.com/demo/image/upload/v1/fgrapher/portfolio/user-1/photo.jpg",
  userId: "user-1",
  type: "IMAGE" as const,
};

const validAsset = {
  public_id: input.publicId,
  secure_url: input.url,
  bytes: 10 * 1024 * 1024,
  format: "jpg",
  resource_type: "image",
};

describe("isValidPortfolioAsset", () => {
  it("accepts a verified asset that belongs to the user and meets the policy", async () => {
    assert.equal(isValidPortfolioAsset(validAsset, input), true);
  });

  it("rejects an oversized asset", () => {
    assert.equal(
      isValidPortfolioAsset(
        { ...validAsset, bytes: 10 * 1024 * 1024 + 1 },
        input,
      ),
      false,
    );
  });

  it("rejects an asset from another user's folder", () => {
    assert.equal(
      isValidPortfolioAsset(
        { ...validAsset, public_id: "fgrapher/portfolio/user-2/photo" },
        input,
      ),
      false,
    );
  });
});
