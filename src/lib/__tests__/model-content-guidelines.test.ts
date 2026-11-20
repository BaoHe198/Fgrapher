import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

// A model accepts the content guidelines before the role is theirs. Sign-up
// has always asked; the two other ways into the role (adding it in
// settings, an approved role change) never did, and paying for it was a
// third. Each must refuse without the acceptance and record when it was
// given.
const read = (path: string) => readFileSync(path, "utf8");

describe("every way into the MODEL role asks for the content guidelines", () => {
  it("adding the role in settings", () => {
    const route = read("src/app/api/users/roles/route.ts");
    assert.match(route, /parsed\.data\.acceptedContentGuidelines !== true/);
    assert.match(route, /error: "guidelines_required"/);
    assert.match(route, /contentGuidelinesAcceptedAt: new Date\(\)/);
  });

  it("asking to change to it, and the approval that follows", () => {
    const service = read("src/services/role-change-requests.ts");
    assert.match(
      service,
      /toRole === "MODEL" && acceptedContentGuidelines !== true/,
    );
    assert.match(service, /contentGuidelinesAcceptedAt: request\.createdAt/);
    assert.match(
      read("src/app/api/users/role-change-requests/route.ts"),
      /parsed\.data\.acceptedContentGuidelines/,
    );
  });

  it("paying only ever renews a role the account already has", () => {
    assert.match(
      read("src/services/payments.ts"),
      /PaymentError\("role_not_held"\)/,
    );
  });

  it("the settings page never sends the acceptance pre-ticked", () => {
    const page = read(
      "src/app/(dashboard)/dashboard/settings/roles/roles-settings.tsx",
    );
    assert.match(page, /useState\(false\);\s*const \[changeGuidelinesAccepted/);
    assert.match(page, /role === "MODEL" && !modelGuidelinesAccepted/);
    assert.match(
      page,
      /changeRequestTarget === "MODEL" && !changeGuidelinesAccepted/,
    );
  });
});
