import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

// /api/admin/users and /api/admin/users/[id] returned whole User rows: a
// bcrypt hash per account, plus each role's identity-document references.
// These read the source because the leak was a missing `omit`, which no
// behavioural unit test can see without a database.
const service = readFileSync("src/services/admin.ts", "utf8");
const route = readFileSync("src/app/api/admin/users/[id]/route.ts", "utf8");

function body(name: string) {
  const start = service.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} not found`);
  const next = service.indexOf("\nexport ", start + 1);
  return service.slice(start, next === -1 ? undefined : next);
}

describe("what the admin user endpoints send to the browser", () => {
  it("never includes the password hash", () => {
    assert.match(service, /ADMIN_USER_OMIT = \{ passwordHash: true \}/);
    assert.match(body("listAdminUsers"), /omit: ADMIN_USER_OMIT/);
    assert.match(body("getAdminUserDetail"), /omit: ADMIN_USER_OMIT/);
  });

  it("never includes identity documents or the ID-number hash", () => {
    const omit = service.slice(
      service.indexOf("const ADMIN_ROLE_OMIT"),
      service.indexOf("export async function getAdminUserDetail("),
    );
    for (const column of [
      "verificationIdUrl",
      "verificationIdPublicId",
      "verificationIdBackUrl",
      "verificationIdBackPublicId",
      "verificationSelfieUrl",
      "verificationSelfiePublicId",
      "verificationBusinessDocUrl",
      "verificationBusinessDocPublicId",
      "idNumberHash",
    ]) {
      assert.match(omit, new RegExp(`${column}: true`), column);
    }
    assert.match(body("getAdminUserDetail"), /roles: \{ omit: ADMIN_ROLE_OMIT/);
  });

  it("answers every action with the filtered detail, not a raw row", () => {
    // `user = await suspendUser(…)` and friends handed back db.user.update's
    // full row. The response must come from getAdminUserDetail alone.
    assert.doesNotMatch(route, /user = await (?!getAdminUserDetail)/);
    assert.match(route, /const user = await getAdminUserDetail\(id\);/);
  });
});
