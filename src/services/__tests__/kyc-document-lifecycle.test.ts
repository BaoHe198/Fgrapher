import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { withoutDeliverySignature } from "@/lib/media/cloudinary";

// CLAUDE.md rule 7: identity documents sit in a private folder, every view
// is logged, and they are deleted after 90 days. Walking the flow on
// 19/11/2026 found the files outliving every reference to them on three
// paths, a permanent signed link stored per document, and two things the
// reviewer was never shown. Behaviour was checked against Cloudinary and a
// database; these keep the wiring from being removed by accident.
const read = (path: string) => readFileSync(path, "utf8");
const verification = read("src/services/verification.ts");
const admin = read("src/services/admin.ts");

describe("stored identity-document URLs", () => {
  it("lose Cloudinary's never-expiring signature", () => {
    assert.equal(
      withoutDeliverySignature(
        "https://res.cloudinary.com/demo/image/authenticated/s--AbC_d-12--/v1795/fgrapher-kyc/u1/front.jpg",
      ),
      "https://res.cloudinary.com/demo/image/authenticated/v1795/fgrapher-kyc/u1/front.jpg",
    );
  });

  it("are left alone when there is no signature", () => {
    const url =
      "https://res.cloudinary.com/demo/image/upload/v1/fgrapher/a/b.jpg";
    assert.equal(withoutDeliverySignature(url), url);
  });

  it("are stripped for all four documents on submission", () => {
    for (const field of [
      "idFrontUrl",
      "idBackUrl",
      "selfieUrl",
      "businessDocUrl",
    ]) {
      assert.ok(
        verification.includes(`withoutDeliverySignature(${field})`),
        field,
      );
    }
  });
});

describe("identity documents never outlive their reference", () => {
  it("a resubmission deletes the previous attempt's files", () => {
    const submit = verification.slice(
      verification.indexOf("export async function submitVerification("),
      verification.indexOf("export async function purgeExpiredKycDocuments("),
    );
    assert.match(submit, /await deleteKycFiles\(userRole, \[/);
  });

  it("removing a role deletes its files before the row goes", () => {
    for (const path of [
      "src/app/api/users/roles/[role]/route.ts",
      "src/services/role-change-requests.ts",
    ]) {
      const text = read(path);
      const purge = text.indexOf("purgeKycDocumentsNow(");
      const drop = text.indexOf("db.userRole.delete(");
      assert.ok(purge > 0 && drop > 0 && purge < drop, path);
    }
  });

  it("deleting an account deletes them at once", () => {
    const compliance = read("src/services/compliance.ts");
    assert.match(
      compliance,
      /purgeKycDocumentsNow\(\{ userId \}, "account_deleted"\)/,
    );
  });

  it("keeps the verification outcome when the files go", () => {
    const cleared = verification.slice(
      verification.indexOf("const KYC_COLUMNS_CLEARED"),
      verification.indexOf(
        "} as const;",
        verification.indexOf("const KYC_COLUMNS_CLEARED"),
      ),
    );
    for (const kept of [
      "verificationStatus",
      "verifiedAt",
      "verifiedBy",
      "idNumberHash",
    ]) {
      assert.doesNotMatch(cleared, new RegExp(`\b${kept}\b`), kept);
    }
  });
});

describe("what the reviewer is given", () => {
  const list = admin.slice(
    admin.indexOf("export async function listPendingVerifications("),
    admin.indexOf("export async function reviewVerification("),
  );

  it("flags another account holding the same ID number", () => {
    assert.match(list, /idNumberHash: \{ in: hashes \}/);
    assert.match(list, /other\.userId !== userId/);
  });

  it("but never sends the hash or the document references", () => {
    // Destructured away before the row is returned.
    assert.match(
      list,
      /\(\{ idNumberHash, verificationBusinessDocPublicId, userId, \.\.\.row \}\)/,
    );
    assert.doesNotMatch(list, /include: \{/);
  });

  it("can open the business certificate, through the logged viewer", () => {
    assert.match(admin, /business: \{\s*url: "verificationBusinessDocUrl"/);
    assert.match(
      read("src/app/api/admin/verifications/[id]/image/route.ts"),
      /"front", "back", "selfie", "business"/,
    );
  });
});
