import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import en from "@/messages/en.json";
import vi from "@/messages/vi.json";

// The local rails (bank transfer, MoMo, ZaloPay) are switched off in every
// environment, so none of this had run before 20/11/2026. It was exercised
// then with the flags on and test keys; these keep what that found fixed.
const payments = readFileSync("src/services/payments.ts", "utf8");
const body = (name: string) => {
  const start = payments.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  const next = payments.indexOf("\nexport ", start + 1);
  return payments.slice(start, next === -1 ? undefined : next);
};

describe("paying for a plan", () => {
  it("is only for a role the account already has", () => {
    // activateRoleFromPayment creates the role it is paid for, so a payment
    // for a role the account never added handed that role over, skipping
    // whatever adding it asks for first.
    assert.match(body("assertPayableRole"), /PaymentError\("role_not_held"\)/);
  });

  it("gives back the open bank-transfer reference instead of a new one", () => {
    const create = body("createBankTransferIntent");
    assert.ok(
      create.indexOf("if (open) return open;") <
        create.indexOf("db.payment.create("),
    );
    assert.match(create, /status: "PENDING"/);
  });

  it("closes bank-transfer intents nobody attached a receipt to", () => {
    const expire = body("expirePaymentIntents");
    assert.match(expire, /provider: "BANK_TRANSFER"/);
    // A submitted receipt waits for an admin however long that takes.
    assert.doesNotMatch(expire, /status: "AWAITING_REVIEW"/);
  });

  it("escapes the reviewer's reason in the rejection email", () => {
    assert.match(payments, /<strong>\$\{escapeHtml\(reason\)\}<\/strong>/);
  });

  it("says why a request was refused, in both languages", () => {
    const route = readFileSync(
      "src/app/api/payments/bank-transfer/route.ts",
      "utf8",
    );
    assert.doesNotMatch(
      route,
      /error: err\.message, message: t\("createFailed"\)/,
    );
    for (const key of [
      "roleNotPayable",
      "paymentNotFound",
      "alreadySubmitted",
      "invalidProof",
      "createFailed",
    ]) {
      assert.match(payments, new RegExp(`"${key}"`), key);
      assert.ok((vi.apiMessages.payments as Record<string, string>)[key], key);
      assert.ok((en.apiMessages.payments as Record<string, string>)[key], key);
    }
  });
});

describe("the renewal reminder", () => {
  const reminder = body("sendSubscriptionRenewalReminders");

  it("skips a free plan that renews itself", () => {
    assert.match(
      reminder,
      /if \(renewsAutomatically\(subscription, features\.billingEnabled\)\) continue;/,
    );
  });

  it("is an email as well as a notification, and is sent once", () => {
    assert.match(reminder, /notificationId: `renewal-\$\{subscription\.id\}/);
    assert.match(reminder, /email: \{/);
    assert.match(reminder, /"RENEWAL_DUE"/);
  });

  it("does not borrow the 'you cancelled' wording", () => {
    assert.doesNotMatch(reminder, /subscriptionCancelling/);
    assert.match(
      vi.libServices.email.subscriptionRenewalDue.body,
      /không tự gia hạn/i,
    );
  });
});
