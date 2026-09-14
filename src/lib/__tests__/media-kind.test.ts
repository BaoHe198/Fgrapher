import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isCloudinaryDeliveryUrl, mediaKindFromUrl } from "@/lib/media-kind";

describe("mediaKindFromUrl", () => {
  it("trusts Cloudinary's resource type in the path over the extension", () => {
    // A video delivered with no extension is still a video.
    assert.equal(
      mediaKindFromUrl("https://res.cloudinary.com/x/video/upload/v1/ref/abc"),
      "VIDEO",
    );
    // And an image path wins even if someone named the file .mp4.
    assert.equal(
      mediaKindFromUrl(
        "https://res.cloudinary.com/x/image/upload/v1/ref/a.mp4",
      ),
      "IMAGE",
    );
  });

  it("falls back to the extension for other hosts", () => {
    assert.equal(mediaKindFromUrl("https://cdn.example.com/clip.MOV"), "VIDEO");
    assert.equal(
      mediaKindFromUrl("https://cdn.example.com/clip.webm?t=1"),
      "VIDEO",
    );
    assert.equal(
      mediaKindFromUrl("https://cdn.example.com/photo.jpg"),
      "IMAGE",
    );
  });

  it("treats anything unrecognised as an image, never throws", () => {
    assert.equal(
      mediaKindFromUrl("https://cdn.example.com/no-extension"),
      "IMAGE",
    );
  });
});

describe("isCloudinaryDeliveryUrl", () => {
  it("accepts only Cloudinary delivery URLs over https", () => {
    assert.equal(
      isCloudinaryDeliveryUrl(
        "https://res.cloudinary.com/x/image/upload/a.jpg",
      ),
      true,
    );
    assert.equal(
      isCloudinaryDeliveryUrl("http://res.cloudinary.com/x/image/upload/a.jpg"),
      false,
    );
    assert.equal(
      isCloudinaryDeliveryUrl(
        "https://evil.example.com/res.cloudinary.com/a.jpg",
      ),
      false,
    );
    assert.equal(
      isCloudinaryDeliveryUrl("https://res.cloudinary.com.evil.com/a.jpg"),
      false,
    );
  });
});
