import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  linkedVideo,
  linkedVideoEmbedUrl,
  linkedVideoProvider,
  linkedVideoUrl,
  videoPosterUrl,
  vimeoVideo,
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

describe("Vimeo links", () => {
  it("reads the id from the links people paste", () => {
    for (const link of [
      "https://vimeo.com/76979871",
      "https://www.vimeo.com/76979871?share=copy",
      "https://player.vimeo.com/video/76979871",
      "https://vimeo.com/channels/staffpicks/76979871",
      "https://vimeo.com/groups/weddingfilms/videos/76979871",
      "https://vimeo.com/showcase/1234567/video/76979871",
      "  https://vimeo.com/76979871  ",
    ]) {
      assert.deepEqual(vimeoVideo(link), { id: "76979871", hash: null }, link);
    }
  });

  it("keeps the key of an unlisted video", () => {
    assert.deepEqual(vimeoVideo("https://vimeo.com/76979871/abc123def0"), {
      id: "76979871",
      hash: "abc123def0",
    });
    assert.deepEqual(
      vimeoVideo("https://player.vimeo.com/video/76979871?h=ABC123DEF0"),
      { id: "76979871", hash: "abc123def0" },
    );
  });

  it("refuses what is not one Vimeo video", () => {
    for (const link of [
      "https://vimeo.com/",
      "https://vimeo.com/user1234567",
      "https://vimeo.com/channels/staffpicks",
      "https://notvimeo.com/76979871",
      "https://vimeo.com.evil.example/76979871",
      "javascript:alert(1)//vimeo.com/76979871",
      "vimeo.com/76979871",
    ]) {
      assert.equal(vimeoVideo(link), null, link);
    }
  });

  it("stores one form of the link and reads it back the same", () => {
    const plain = linkedVideo("https://player.vimeo.com/video/76979871");
    assert.ok(plain);
    assert.equal(linkedVideoUrl(plain), "https://vimeo.com/76979871");
    assert.deepEqual(linkedVideo(linkedVideoUrl(plain)), plain);

    const unlisted = linkedVideo("https://vimeo.com/76979871/abc123def0");
    assert.ok(unlisted);
    assert.equal(
      linkedVideoUrl(unlisted),
      "https://vimeo.com/76979871/abc123def0",
    );
    assert.deepEqual(linkedVideo(linkedVideoUrl(unlisted)), unlisted);
  });

  it("plays in Vimeo's own player, asked not to track", () => {
    const video = linkedVideo("https://vimeo.com/76979871/abc123def0");
    assert.ok(video);
    assert.equal(
      linkedVideoEmbedUrl(video),
      "https://player.vimeo.com/video/76979871?dnt=1&h=abc123def0",
    );
    assert.equal(
      linkedVideoEmbedUrl(video, true),
      "https://player.vimeo.com/video/76979871?dnt=1&h=abc123def0&autoplay=1",
    );
    assert.equal(linkedVideoProvider(video), "Vimeo");
  });

  it("asks this app for the poster, which looks it up at Vimeo", () => {
    assert.equal(
      videoPosterUrl("https://vimeo.com/76979871"),
      "/api/media/vimeo-poster/76979871",
    );
    assert.equal(
      videoPosterUrl("https://vimeo.com/76979871/abc123def0"),
      "/api/media/vimeo-poster/76979871?h=abc123def0",
    );
  });
});

describe("linkedVideo", () => {
  it("tells a YouTube link, a Vimeo link and an uploaded file apart", () => {
    assert.deepEqual(linkedVideo(youtubeWatchUrl(ID)), {
      provider: "youtube",
      id: ID,
    });
    assert.equal(
      linkedVideoUrl({ provider: "youtube", id: ID }),
      youtubeWatchUrl(ID),
    );
    assert.equal(
      linkedVideoEmbedUrl({ provider: "youtube", id: ID }),
      youtubeEmbedUrl(ID),
    );
    assert.equal(
      linkedVideo(
        "https://res.cloudinary.com/demo/video/upload/v17/fgrapher/portfolio/u1/clip.mp4",
      ),
      null,
    );
  });
});
