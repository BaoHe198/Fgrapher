import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import type { StyleSpecification } from "maplibre-gl";

import { slimMapStyle } from "@/lib/map-style";

// A cut of the OpenFreeMap "liberty" style: one layer of each kind the
// trimming has to decide about, with the real layer names.
const liberty = {
  version: 8,
  sprite: "https://tiles.openfreemap.org/sprites/ofm_f384/ofm",
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    ne2_shaded: {
      type: "raster",
      tiles: ["https://example.test/{z}/{x}/{y}.png"],
    },
    openmaptiles: {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#f8f4f0" },
    },
    { id: "natural_earth", type: "raster", source: "ne2_shaded" },
    {
      id: "water",
      type: "fill",
      source: "openmaptiles",
      paint: { "fill-color": "#a0c8f0" },
    },
    {
      id: "road_area_pattern",
      type: "fill",
      source: "openmaptiles",
      paint: { "fill-pattern": "pedestrian_polygon", "fill-opacity": 0.8 },
    },
    {
      id: "road_motorway",
      type: "line",
      source: "openmaptiles",
      paint: { "line-color": "#fc8" },
    },
    {
      id: "road_one_way_arrow",
      type: "symbol",
      source: "openmaptiles",
      layout: { "icon-image": "arrow" },
    },
    { id: "building-3d", type: "fill-extrusion", source: "openmaptiles" },
    {
      id: "water_name_line_label",
      type: "symbol",
      source: "openmaptiles",
      layout: { "text-field": "{name}", "text-font": ["Noto Sans Italic"] },
    },
    {
      id: "poi_r20",
      type: "symbol",
      source: "openmaptiles",
      layout: {
        "icon-image": "{class}",
        "text-field": "{name}",
        "text-font": ["Noto Sans Italic"],
      },
    },
    {
      id: "poi_r1",
      type: "symbol",
      source: "openmaptiles",
      layout: {
        "icon-image": "{class}",
        "text-field": "{name}",
        "text-font": ["Noto Sans Italic"],
        "text-anchor": "top",
      },
    },
    {
      id: "highway-shield-non-us",
      type: "symbol",
      source: "openmaptiles",
      layout: {
        "icon-image": "road_{ref_length}",
        "text-field": "{ref}",
        "text-font": ["Noto Sans Regular"],
      },
    },
    {
      id: "airport",
      type: "symbol",
      source: "openmaptiles",
      layout: {
        "icon-image": "airport_11",
        "icon-size": 1,
        "text-field": "{name}",
        "text-font": ["Noto Sans Regular"],
      },
      paint: { "icon-opacity": 0.8, "text-color": "#666" },
    },
    {
      id: "label_city",
      type: "symbol",
      source: "openmaptiles",
      layout: { "text-field": "{name}", "text-font": ["Noto Sans Bold"] },
    },
  ],
} as unknown as StyleSpecification;

interface Layer {
  id: string;
  type: string;
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
}

describe("bản đồ nền đã lược bớt", () => {
  const slim = slimMapStyle(liberty);
  const layers = slim.layers as unknown as Layer[];
  const byId = (id: string) => layers.find((layer) => layer.id === id);

  it("giữ nền, địa hình, nước, đường, nhà cửa và các nhãn địa danh", () => {
    assert.deepEqual(
      layers.map((layer) => layer.id),
      [
        "background",
        "natural_earth",
        "water",
        "road_area_pattern",
        "road_motorway",
        "building-3d",
        "water_name_line_label",
        "poi_r1",
        "airport",
        "label_city",
      ],
    );
    assert.deepEqual(Object.keys(slim.sources), ["ne2_shaded", "openmaptiles"]);
  });

  it("bỏ bộ biểu tượng, và không lớp nào còn cần đến nó", () => {
    assert.equal("sprite" in slim, false);
    for (const layer of layers) {
      for (const key of [
        ...Object.keys(layer.layout ?? {}),
        ...Object.keys(layer.paint ?? {}),
      ]) {
        assert.ok(
          !key.startsWith("icon-") && !key.endsWith("-pattern"),
          `${layer.id} vẫn cần bộ biểu tượng (${key}): trình duyệt sẽ báo thiếu ảnh`,
        );
      }
    }
  });

  it("nhãn có kèm biểu tượng thì giữ chữ: sân bay và địa danh lớn", () => {
    assert.equal(byId("airport")?.layout?.["text-field"], "{name}");
    assert.equal(byId("airport")?.paint?.["text-color"], "#666");
    assert.equal(byId("poi_r1")?.layout?.["text-field"], "{name}");
    assert.equal(byId("poi_r1")?.layout?.["text-anchor"], "top");
  });

  it("bỏ quán xá, trạm xe, biển số đường và mũi tên một chiều", () => {
    for (const id of [
      "poi_r20",
      "highway-shield-non-us",
      "road_one_way_arrow",
    ]) {
      assert.equal(byId(id), undefined, id);
    }
  });

  it("vùng vẽ bằng họa tiết được tô màu phẳng, không biến mất", () => {
    const area = byId("road_area_pattern");
    assert.equal(typeof area?.paint?.["fill-color"], "string");
    assert.equal(area?.paint?.["fill-opacity"], 0.8);
  });

  it("mọi nhãn dùng chung một phông, để chỉ tải một bộ phông", () => {
    const fonts = new Set(
      layers
        .filter((layer) => layer.type === "symbol")
        .map((layer) => JSON.stringify(layer.layout?.["text-font"])),
    );
    assert.deepEqual([...fonts], ['["Noto Sans Regular"]']);
  });

  it("không sửa kiểu gốc được truyền vào", () => {
    const original = liberty.layers as unknown as Layer[];
    assert.equal(original.length, 13);
    assert.equal("sprite" in liberty, true);
    assert.deepEqual(
      original.find((layer) => layer.id === "water_name_line_label")?.layout?.[
        "text-font"
      ],
      ["Noto Sans Italic"],
    );
    assert.equal(
      original.find((layer) => layer.id === "road_area_pattern")?.paint?.[
        "fill-pattern"
      ],
      "pedestrian_polygon",
    );
  });
});

describe("mọi bản đồ trong ứng dụng dùng chung một kiểu nền", () => {
  const read = (file: string) =>
    fs.readFileSync(path.join(process.cwd(), file), "utf8");

  for (const file of [
    "src/components/fmap/fmap-map.tsx",
    "src/components/places/place-mini-map.tsx",
    "src/components/places/place-pin-map.tsx",
    "src/components/profile/service-area-map.tsx",
  ]) {
    it(`${file} lấy kiểu nền từ lib/map-style`, () => {
      const source = read(file);
      assert.match(source, /applyBaseMapStyle\(map\)/);
      assert.doesNotMatch(
        source,
        /openfreemap\.org\/styles|NEXT_PUBLIC_MAP_STYLE_URL/,
        `${file} tự chọn kiểu bản đồ: mỗi nơi một kiểu thì phần lược bớt bị bỏ sót.`,
      );
    });
  }
});
