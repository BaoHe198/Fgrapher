import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  goongForwardGeocode,
  resolveGoongPlace,
  suggestGoongAddresses,
} from "@/services/goong";

function response(body: unknown, ok = true) {
  return {
    ok,
    async json() {
      return body;
    },
  } as Response;
}

const context = { ward: "Phường Sài Gòn", province: "Thành phố Hồ Chí Minh" };

describe("suggestGoongAddresses", () => {
  it("does not call the network without an API key", async () => {
    let called = false;
    const result = await suggestGoongAddresses("12 Lê Lợi", context, {
      apiKey: "",
      fetchImpl: async () => {
        called = true;
        return response({});
      },
    });
    assert.deepEqual(result, { success: false, reason: "not_configured" });
    assert.equal(called, false);
  });

  it("sends the ward and province as context and maps predictions", async () => {
    let requestedUrl = "";
    const result = await suggestGoongAddresses("12 Lê Lợi", context, {
      apiKey: "test-key",
      fetchImpl: async (url) => {
        requestedUrl = String(url);
        return response({
          predictions: [
            { description: "12 Lê Lợi, Phường Sài Gòn", place_id: "abc" },
            { description: "", place_id: "empty" },
            { description: "no id" },
          ],
        });
      },
    });
    const requested = new URL(requestedUrl);
    assert.equal(
      requested.searchParams.get("input"),
      "12 Lê Lợi, Phường Sài Gòn, Thành phố Hồ Chí Minh",
    );
    assert.equal(requested.searchParams.get("api_key"), "test-key");
    assert.deepEqual(result, {
      success: true,
      suggestions: [{ id: "abc", label: "12 Lê Lợi, Phường Sài Gòn" }],
    });
  });

  it("reports upstream failures without leaking the response", async () => {
    const result = await suggestGoongAddresses("12 Lê Lợi", context, {
      apiKey: "test-key",
      fetchImpl: async () => response({ message: "quota" }, false),
    });
    assert.deepEqual(result, { success: false, reason: "upstream_error" });
  });
});

describe("resolveGoongPlace", () => {
  it("returns the place's point", async () => {
    const result = await resolveGoongPlace("abc", {
      apiKey: "test-key",
      fetchImpl: async (url) => {
        assert.equal(new URL(String(url)).searchParams.get("place_id"), "abc");
        return response({
          result: { geometry: { location: { lat: 10.7743, lng: 106.7019 } } },
        });
      },
    });
    assert.deepEqual(result, {
      success: true,
      latitude: 10.7743,
      longitude: 106.7019,
    });
  });

  it("rejects a malformed location", async () => {
    const result = await resolveGoongPlace("abc", {
      apiKey: "test-key",
      fetchImpl: async () =>
        response({ result: { geometry: { location: { lat: "x", lng: 1 } } } }),
    });
    assert.deepEqual(result, { success: false, reason: "invalid_response" });
  });

  it("returns not_found when the place has no geometry", async () => {
    const result = await resolveGoongPlace("abc", {
      apiKey: "test-key",
      fetchImpl: async () => response({ result: {} }),
    });
    assert.deepEqual(result, { success: false, reason: "not_found" });
  });
});

describe("goongForwardGeocode", () => {
  it("geocodes the joined address and takes the first result", async () => {
    let requestedUrl = "";
    const result = await goongForwardGeocode(
      { address: "12 Lê Lợi", ward: context.ward, province: context.province },
      {
        apiKey: "test-key",
        fetchImpl: async (url) => {
          requestedUrl = String(url);
          return response({
            results: [
              { geometry: { location: { lat: 10.7743, lng: 106.7019 } } },
              { geometry: { location: { lat: 1, lng: 1 } } },
            ],
          });
        },
      },
    );
    assert.equal(
      new URL(requestedUrl).searchParams.get("address"),
      "12 Lê Lợi, Phường Sài Gòn, Thành phố Hồ Chí Minh, Việt Nam",
    );
    assert.deepEqual(result, {
      success: true,
      latitude: 10.7743,
      longitude: 106.7019,
    });
  });

  it("times out instead of hanging the profile save", async () => {
    const result = await goongForwardGeocode(
      { address: "12 Lê Lợi", ward: context.ward, province: context.province },
      {
        apiKey: "test-key",
        timeoutMs: 10,
        fetchImpl: (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              const error = new Error("aborted");
              error.name = "AbortError";
              reject(error);
            });
          }),
      },
    );
    assert.deepEqual(result, { success: false, reason: "timeout" });
  });
});
