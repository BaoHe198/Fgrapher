import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Role } from "@prisma/client";

import {
  SERVICE_KINDS,
  SERVICE_KINDS_BY_ROLE,
  serviceKindAllowedForRole,
  serviceKindsForRole,
} from "@/lib/constants/service-matrix";

describe("service matrix", () => {
  it("lets a studio offer the crew services, which is the whole point", () => {
    assert.ok(serviceKindAllowedForRole("STUDIO", "VENUE_RENTAL"));
    assert.ok(serviceKindAllowedForRole("STUDIO", "PHOTOGRAPHY"));
    assert.ok(serviceKindAllowedForRole("STUDIO", "VIDEOGRAPHY"));
    assert.ok(serviceKindAllowedForRole("STUDIO", "MAKEUP"));
  });

  it("keeps venue rental to studios only", () => {
    for (const role of Object.keys(SERVICE_KINDS_BY_ROLE) as Role[]) {
      if (role === "STUDIO") continue;
      assert.equal(serviceKindAllowedForRole(role, "VENUE_RENTAL"), false);
    }
  });

  it("lets photographers and videographers cross over", () => {
    assert.ok(serviceKindAllowedForRole("PHOTOGRAPHER", "VIDEOGRAPHY"));
    assert.ok(serviceKindAllowedForRole("VIDEOGRAPHER", "PHOTOGRAPHY"));
  });

  it("does not let a make-up artist offer modelling", () => {
    assert.equal(serviceKindAllowedForRole("MAKEUP_ARTIST", "MODELING"), false);
  });

  it("gives the shop roles no services at all", () => {
    assert.deepEqual(serviceKindsForRole("CAMERA_SHOP"), []);
    assert.deepEqual(serviceKindsForRole("COSTUME_SHOP"), []);
    assert.equal(
      serviceKindAllowedForRole("CAMERA_SHOP", "PHOTOGRAPHY"),
      false,
    );
  });

  it("rejects a value that is not a service at all", () => {
    assert.equal(serviceKindAllowedForRole("STUDIO", "RETOUCH"), false);
  });

  it("never lists a service outside SERVICE_KINDS", () => {
    for (const kinds of Object.values(SERVICE_KINDS_BY_ROLE)) {
      for (const kind of kinds ?? []) {
        assert.ok(
          (SERVICE_KINDS as readonly string[]).includes(kind),
          `${kind} is not a declared service kind`,
        );
      }
    }
  });
});
