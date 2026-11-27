// The base map every map in the app draws on (Bản đồ F, the profile's
// service area, a photo spot's mini map and pin picker). Type-only imports:
// nothing here pulls the map engine into a bundle or a test.
import type { Map as MapInstance, StyleSpecification } from "maplibre-gl";

// Keyless fallback when NEXT_PUBLIC_MAP_STYLE_URL is unset. OpenFreeMap
// serves vector tiles with no API key or request quota, unlike the public
// tile.openstreetmap.org servers — whose usage policy forbids app traffic and
// whose hostname some Vietnamese ISP resolvers return NXDOMAIN for, which
// left the map blank during local testing.
const FALLBACK_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

// The one label font kept. It must be a font stack the fallback's glyph
// server has; that is why slimMapStyle is only applied to the fallback.
const LABEL_FONT = ["Noto Sans Regular"];

// Points of interest below the top rank (cafés, shops, ATMs) and transit
// stops. They are what crowds a street-level view, and on a map whose point
// is our own markers they compete with them. The top rank — the landmarks
// people navigate by — keeps its names (see slimMapStyle).
const DROPPED_LABEL_LAYERS = new Set(["poi_r7", "poi_r20", "poi_transit"]);

// Two areas were drawn with a pattern from the icon sheet. Without the sheet
// they are filled with a flat colour close to what the pattern looked like
// from a distance, so the area is still there.
const PATTERN_FILL: Record<string, string> = {
  road_area_pattern: "hsl(35, 14%, 90%)",
  landcover_wetland: "hsl(165, 22%, 88%)",
};
const PATTERN_FILL_DEFAULT = "hsl(35, 14%, 90%)";

interface LooseLayer {
  id: string;
  type: string;
  source?: string;
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
}

function withoutIconProps(props: Record<string, unknown> | undefined) {
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props ?? {})) {
    if (!key.startsWith("icon-")) kept[key] = value;
  }
  return kept;
}

/**
 * The fallback style without its icon sheet and with one label font. Same
 * colours, roads, buildings and place names.
 *
 * Measured 27/11/2026 (docs/reviews/performance-test-2026-11-27.md): the
 * weight of this map was never its number of layers — a style with half as
 * many was only 5–7% faster. It was two downloads every style shares: 308 KB
 * of label fonts (two font stacks, three or four ranges each) and a 120 KB
 * icon sheet. So:
 *
 * - no icon sheet. Layers that only drew an icon go (one-way arrows,
 *   road-number shields); a label that carried an icon keeps its text;
 *   lesser points of interest and transit stops go entirely;
 * - one label font: district and water names were italic, and are upright;
 * - the two pattern-filled areas get a flat colour.
 *
 * That leaves 166 KB in 6 requests instead of 436 KB in 11, before tiles,
 * and the map is ready about 1.3 s sooner on a slow connection. Buildings
 * (flat and 3D) and the low-zoom relief stay: they come with the tiles and
 * cost nothing extra to fetch.
 *
 * The argument is not changed; a new style object is returned.
 */
export function slimMapStyle(style: StyleSpecification): StyleSpecification {
  const layers: LooseLayer[] = [];

  for (const layer of style.layers as unknown as LooseLayer[]) {
    if (layer.type === "symbol") {
      if (
        DROPPED_LABEL_LAYERS.has(layer.id) ||
        layer.id.includes("shield") ||
        layer.id.includes("one_way_arrow")
      ) {
        continue;
      }
      // A symbol layer with no text at all was only ever an icon.
      const layout = withoutIconProps(layer.layout);
      if (layout["text-field"] === undefined) continue;
      layout["text-font"] = LABEL_FONT;
      layers.push({ ...layer, layout, paint: withoutIconProps(layer.paint) });
      continue;
    }

    const paint = layer.paint ?? {};
    if (paint["fill-pattern"] !== undefined) {
      const flat: Record<string, unknown> = {
        "fill-color": PATTERN_FILL[layer.id] ?? PATTERN_FILL_DEFAULT,
      };
      for (const [key, value] of Object.entries(paint)) {
        if (key !== "fill-pattern") flat[key] = value;
      }
      layers.push({ ...layer, paint: flat });
      continue;
    }
    // A patterned line or background has no flat stand-in worth keeping.
    if (
      paint["line-pattern"] !== undefined ||
      paint["background-pattern"] !== undefined
    ) {
      continue;
    }
    layers.push(layer);
  }

  const slim: Record<string, unknown> = { ...style, layers };
  // With no layer left that draws an icon or a pattern, the sheet is dead
  // weight; without this line the engine still downloads it.
  delete slim.sprite;
  return slim as unknown as StyleSpecification;
}

/**
 * Gives a freshly created map (one constructed WITHOUT a `style` option) its
 * base style. A provider style configured through NEXT_PUBLIC_MAP_STYLE_URL
 * is used exactly as it is; only the built-in fallback is slimmed, because
 * slimMapStyle is written against that style's layer names and fonts.
 */
export function applyBaseMapStyle(map: MapInstance) {
  const configured = process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim();
  if (configured) {
    map.setStyle(configured);
    return;
  }
  map.setStyle(FALLBACK_STYLE_URL, {
    transformStyle: (_previous, next) => slimMapStyle(next),
  });
}
