import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  videoPosterUrl,
  youtubeEmbedUrl,
  youtubeVideoId,
  youtubeWatchUrl,
} from "@/lib/media/video-link";

const ID = "aqz-KE-bpKQ";

describe("youtubeVideoId", () => {
  it("reads the id from the links people paste", () => {
    for (const link of [
      `https://www.youtube.com/watch?v=${ID}`,
      `https://youtube.com/watch?v=${ID}&t=42s`,
      `https://m.youtube.com/watch?feature=share&v=${ID}`,
      `https://youtu.be/${ID}`,
      `https://youtu.be/${ID}?si=abcdef`,
      `https://www.youtube.com/shorts/${ID}`,
      `https://www.youtube.com/embed/${ID}`,
      `https://www.youtube.com/live/${ID}?feature=share`,
      `  https://youtu.be/${ID}  `,
    ]) {
      assert.equal(youtubeVideoId(link), ID, link);
    }
  });

  it("refuses everything that is not one YouTube video", () => {
    for (const link of [
      "",
      "not a link",
      "https://vimeo.com/123456789",
      "https://www.youtube.com/@somechannel",
      "https://www.youtube.com/playlist?list=PL123",
      "https://www.youtube.com/watch?v=short",
      // A look-alike host must not pass as YouTube.
      `https://youtube.com.example.org/watch?v=${ID}`,
      `https://example.org/?u=https://youtu.be/${ID}`,
      `javascript:alert("https://youtu.be/${ID}")`,
    ]) {
      assert.equal(youtubeVideoId(link), null, link);
    }
  });

  it("round-trips through the stored form", () => {
    assert.equal(youtubeVideoId(youtubeWatchUrl(ID)), ID);
  });
});

describe("youtubeEmbedUrl", () => {
  it("plays from the no-cookie host the CSP allows", () => {
    assert.equal(
      youtubeEmbedUrl(ID),
      `https://www.youtube-nocookie.com/embed/${ID}?rel=0`,
    );
    assert.match(youtubeEmbedUrl(ID, true), /&autoplay=1$/);
  });
});

describe("videoPosterUrl", () => {
  it("uses YouTube's thumbnail for a link", () => {
    // The one every video has, and 16:9 like the film.
    assert.equal(
      videoPosterUrl(youtubeWatchUrl(ID)),
      `https://i.ytimg.com/vi/${ID}/mqdefault.jpg`,
    );
    assert.equal(
      videoPosterUrl(youtubeWatchUrl(ID), { sharp: true }),
      `https://i.ytimg.com/vi/${ID}/hq720.jpg`,
    );
  });

  it("asks Cloudinary for the first frame of an uploaded video", () => {
    assert.equal(
      videoPosterUrl(
        "https://res.cloudinary.com/demo/video/upload/v17/fgrapher/portfolio/u1/clip.mp4",
      ),
      "https://res.cloudinary.com/demo/video/upload/so_0,c_limit,w_800,q_auto/v17/fgrapher/portfolio/u1/clip.jpg",
    );
  });

  it("has nothing to offer for a photo or an unknown host", () => {
    assert.equal(
      videoPosterUrl(
        "https://res.cloudinary.com/demo/image/upload/v17/photo.jpg",
      ),
      null,
    );
    assert.equal(videoPosterUrl("https://example.org/clip.mp4"), null);
  });
});
