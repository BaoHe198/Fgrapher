import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { isReservedUsername } from "@/lib/account/username";
import { registerSchema } from "@/lib/validations/auth";
import { updateMeSchema } from "@/lib/validations/user";

const person = {
  name: "Nguyễn Văn An",
  password: "Test1234!",
  accountType: "customer" as const,
  roles: [],
  dateOfBirth: "1995-05-05",
  consentService: true,
  consentMarketing: false,
  consentAnalytics: false,
};

describe("one inbox, one account", () => {
  it("stores a new address in lower case, without stray spaces", () => {
    const parsed = registerSchema.parse({
      ...person,
      email: "  An.Nguyen@Gmail.COM ",
    });
    assert.equal(parsed.email, "an.nguyen@gmail.com");
  });

  it("does the same when the sign-in address is changed", () => {
    assert.equal(
      updateMeSchema.parse({ email: "New@Example.COM" }).email,
      "new@example.com",
    );
  });

  it("looks accounts up through the case-insensitive helper", () => {
    // Registration, sign-in and password reset each looked the address up
    // exactly as typed, so "An@gmail.com" and "an@gmail.com" were two
    // accounts and the first could not sign in as the second.
    for (const path of [
      "src/app/api/auth/register/route.ts",
      "src/app/api/auth/forgot-password/route.ts",
      "src/lib/auth.ts",
      "src/app/api/users/me/route.ts",
    ]) {
      assert.match(readFileSync(path, "utf8"), /findUserIdByEmail\(/, path);
    }
    assert.match(
      readFileSync("src/lib/auth.ts", "utf8"),
      /login-email:\$\{parsed\.data\.email\.trim\(\)\.toLowerCase\(\)\}/,
    );
  });
});

describe("usernames", () => {
  it("keeps names a visitor would take for Fgrapher itself", () => {
    for (const name of ["admin", "support", "fgrapher", "hotro", "Admin"]) {
      assert.equal(isReservedUsername(name), true, name);
    }
    assert.equal(isReservedUsername("minhanh_studio"), false);
  });

  it("refuses them in the account form", () => {
    assert.equal(
      updateMeSchema.safeParse({ username: "admin" }).success,
      false,
    );
    assert.equal(
      updateMeSchema.safeParse({ username: "minhanh_studio" }).success,
      true,
    );
  });
});

describe("an account that goes dark", () => {
  it("has its open business closed first, on both deactivation paths", () => {
    const self = readFileSync("src/app/api/users/me/route.ts", "utf8");
    const del = self.slice(self.indexOf("export async function DELETE"));
    assert.ok(
      del.indexOf("windDownAccount(session.user.id)") > 0 &&
        del.indexOf("windDownAccount(session.user.id)") <
          del.indexOf("deletedAt: new Date()"),
    );
    const admin = readFileSync("src/services/admin.ts", "utf8");
    const soft = admin.slice(
      admin.indexOf("export async function softDeleteAdminUser("),
    );
    assert.ok(
      soft.indexOf("windDownAccount(userId)") <
        soft.indexOf("deletedAt: new Date()"),
    );
  });

  it("takes its listings and posts out of public view", () => {
    const market = readFileSync("src/services/marketplace.ts", "utf8");
    assert.ok(market.split("user: ACTIVE_ACCOUNT").length - 1 >= 4);
    const posts = readFileSync("src/services/posts.ts", "utf8");
    assert.ok(posts.split("user: ACTIVE_ACCOUNT").length - 1 >= 2);
  });
});
