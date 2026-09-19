import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildGeocodeAddressHash,
  forwardGeocode,
  normalizeAddressPart,
  suggestAddresses,
} from "@/services/geocoding";

function response(body: unknown, ok = true) {
  return {
    ok,
    async json() {
      return body;
    },
  } as Response;
}

describe("geocoding address identity", () => {
  it("normalizes Unicode, whitespace and case before hashing", () => {
    assert.equal(normalizeAddressPart("  12   Nguyễn Huệ  "), "12 nguyễn huệ");
    const a = buildGeocodeAddressHash({
      address: "12  Nguyễn Huệ",
      ward: "Bến Thành",
      province: "Thành phố Hồ Chí Minh",
    });
    const b = buildGeocodeAddressHash({
      address: "  12 Nguyễn Huệ ",
      ward: "bến thành",
      province: "THÀNH PHỐ HỒ CHÍ MINH",
    });
    assert.equal(a, b);
  });
});

describe("forwardGeocode", () => {
  const input = {
    address: "12 Nguyễn Huệ",
    ward: "Phường Bến Thành",
    province: "Thành phố Hồ Chí Minh",
  };

  it("does not call the network without a server API key", async () => {
    let called = false;
    const result = await forwardGeocode(input, {
      apiKey: "",
      fetchImpl: async () => {
        called = true;
        return response({});
      },
    });
    assert.deepEqual(result, { success: false, reason: "not_configured" });
    assert.equal(called, false);
  });

  it("returns a validated point and sends Vietnam-specific parameters", async () => {
    let requestedUrl = "";
    const result = await forwardGeocode(input, {
      apiKey: "test-key",
      fetchImpl: async (url) => {
        requestedUrl = String(url);
        return response({
          features: [
            { geometry: { type: "Point", coordinates: [106.7, 10.78] } },
          ],
        });
      },
    });
    assert.deepEqual(result, {
      success: true,
      latitude: 10.78,
      longitude: 106.7,
    });
    const requested = new URL(requestedUrl);
    assert.equal(requested.searchParams.get("country"), "vn");
    assert.equal(requested.searchParams.get("autocomplete"), "false");
    assert.equal(requested.searchParams.get("key"), "test-key");
  });

  it("rejects malformed coordinates", async () => {
    const result = await forwardGeocode(input, {
      apiKey: "test-key",
      fetchImpl: async () =>
        response({
          features: [
            { geometry: { type: "Point", coordinates: [999, "invalid"] } },
          ],
        }),
    });
    assert.deepEqual(result, { success: false, reason: "invalid_response" });
  });

  it("returns timeout when the request exceeds its deadline", async () => {
    const result = await forwardGeocode(input, {
      apiKey: "test-key",
      timeoutMs: 5,
      fetchImpl: (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    });
    assert.deepEqual(result, { success: false, reason: "timeout" });
  });

  it("collapses upstream failures without returning response details", async () => {
    const result = await forwardGeocode(input, {
      apiKey: "secret-key",
      fetchImpl: async () => response({ message: "secret-key" }, false),
    });
    assert.deepEqual(result, { success: false, reason: "upstream_error" });
  });
});

describe("suggestAddresses", () => {
  const context = {
    ward: "Phường Sài Gòn",
    province: "Thành phố Hồ Chí Minh",
  };

  it("does not call the network without a server API key", async () => {
    let called = false;
    const result = await suggestAddresses("12 Nguyễn Huệ", context, {
      apiKey: "",
      fetchImpl: async () => {
        called = true;
        return response({});
      },
    });
    assert.deepEqual(result, { success: false, reason: "not_configured" });
    assert.equal(called, false);
  });

  it("returns empty suggestions for queries shorter than MIN_SUGGEST_QUERY_LENGTH", async () => {
    let called = false;
    const result = await suggestAddresses("ab", context, {
      apiKey: "test-key",
      fetchImpl: async () => {
        called = true;
        return response({});
      },
    });
    assert.deepEqual(result, { success: true, suggestions: [] });
    assert.equal(called, false);
  });

  it("sends autocomplete=true, country=vn, limit=5 and the joined text", async () => {
    let requestedUrl = "";
    const result = await suggestAddresses("12 Nguyễn Huệ", context, {
      apiKey: "test-key",
      fetchImpl: async (url) => {
        requestedUrl = String(url);
        return response({
          features: [],
        });
      },
    });

    assert.deepEqual(result, { success: true, suggestions: [] });

    const requested = new URL(requestedUrl);
    assert.equal(requested.searchParams.get("country"), "vn");
    assert.equal(requested.searchParams.get("autocomplete"), "true");
    assert.equal(requested.searchParams.get("limit"), "5");
    assert.equal(requested.searchParams.get("key"), "test-key");

    // Check that the URL pathname is properly encoded
    const pathname = requested.pathname;
    // Should contain the properly encoded query text
    assert.ok(
      pathname.includes(
        encodeURIComponent(
          "12 Nguyễn Huệ, Phường Sài Gòn, Thành phố Hồ Chí Minh",
        ),
      ),
    );
  });

  it("maps two valid features and drops invalid ones", async () => {
    const result = await suggestAddresses("12 Nguyễn Huệ", context, {
      apiKey: "test-key",
      fetchImpl: async () =>
        response({
          features: [
            {
              id: "1",
              place_name:
                "12 Nguyễn Huệ, Phường Sài Gòn, Hồ Chí Minh, Việt Nam",
              geometry: { type: "Point", coordinates: [106.7019, 10.7743] },
            },
            {
              id: "2",
              place_name:
                "12 Nguyễn Huệ, Phường Bến Thành, Hồ Chí Minh, Việt Nam",
              geometry: { type: "Point", coordinates: [106.7029, 10.7753] },
            },
            {
              id: "3",
              // Missing place_name
              geometry: { type: "Point", coordinates: [500, 10] },
            },
            {
              id: "4",
              place_name: "Another address",
              geometry: { type: "Point", coordinates: [999, 10] }, // Invalid coordinates
            },
          ],
        }),
    });

    assert.deepEqual(result, {
      success: true,
      suggestions: [
        {
          id: "1",
          label: "12 Nguyễn Huệ, Phường Sài Gòn, Hồ Chí Minh, Việt Nam",
          longitude: 106.7019,
          latitude: 10.7743,
        },
        {
          id: "2",
          label: "12 Nguyễn Huệ, Phường Bến Thành, Hồ Chí Minh, Việt Nam",
          longitude: 106.7029,
          latitude: 10.7753,
        },
      ],
    });
  });

  it("returns upstream_error for non-ok responses", async () => {
    const result = await suggestAddresses("12 Nguyễn Huệ", context, {
      apiKey: "test-key",
      fetchImpl: async () => response({}, false),
    });
    assert.deepEqual(result, { success: false, reason: "upstream_error" });
  });
});
