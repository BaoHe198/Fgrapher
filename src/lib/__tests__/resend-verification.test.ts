import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canSubmitResend,
  rememberAttemptedEmail,
  takeAttemptedEmail,
} from "@/lib/resend-verification";

// Guards the resend prompt against being rendered in a state where it can
// never be submitted. A draft of the login page's compact prompt hid the
// email field while still gating the button on a non-empty address, so the
// only way to resend a verification link from the login page was dead.

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    size: () => data.size,
  };
}

describe("canSubmitResend", () => {
  it("enables the button as soon as an address is present", () => {
    assert.equal(
      canSubmitResend({ status: "idle", email: "nguyen@example.com" }),
      true,
    );
  });

  it("disables it with no address", () => {
    assert.equal(canSubmitResend({ status: "idle", email: "" }), false);
    assert.equal(canSubmitResend({ status: "idle", email: "   " }), false);
  });

  it("disables it while a request is in flight", () => {
    assert.equal(
      canSubmitResend({ status: "sending", email: "nguyen@example.com" }),
      false,
    );
  });

  it("keeps it disabled after a successful request", () => {
    // Issuing a link invalidates the previous one, so letting someone fire
    // several in a row hands them an inbox of dead links.
    assert.equal(
      canSubmitResend({ status: "sent", email: "nguyen@example.com" }),
      false,
    );
  });

  it("re-enables it after a failure so the user can retry", () => {
    assert.equal(
      canSubmitResend({ status: "error", email: "nguyen@example.com" }),
      true,
    );
  });

  it("is submittable from an empty start once the user types", () => {
    // The regression in one assertion: whatever the layout, a form that
    // starts with no address must become submittable. If a variant renders
    // no field, `email` can never leave "" and the button is dead forever.
    let email = "";
    assert.equal(canSubmitResend({ status: "idle", email }), false);
    email = "nguyen@example.com";
    assert.equal(canSubmitResend({ status: "idle", email }), true);
  });
});

describe("attempted-email handoff", () => {
  it("gives the address back to the prompt", () => {
    const storage = fakeStorage();
    rememberAttemptedEmail("nguyen@example.com", storage);
    assert.equal(takeAttemptedEmail(storage), "nguyen@example.com");
  });

  it("clears the address once read, so it doesn't outlive the attempt", () => {
    const storage = fakeStorage();
    rememberAttemptedEmail("nguyen@example.com", storage);

    takeAttemptedEmail(storage);

    assert.equal(storage.size(), 0);
    assert.equal(takeAttemptedEmail(storage), "");
  });

  it("returns an empty string when nothing was remembered", () => {
    assert.equal(takeAttemptedEmail(fakeStorage()), "");
  });

  it("hands back a prefill that is immediately submittable", () => {
    const storage = fakeStorage();
    rememberAttemptedEmail("nguyen@example.com", storage);

    const email = takeAttemptedEmail(storage);

    assert.equal(canSubmitResend({ status: "idle", email }), true);
  });

  it("survives storage being unavailable", () => {
    // Private windows and browsers set to block site data throw on access.
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };

    assert.doesNotThrow(() => rememberAttemptedEmail("a@b.com", throwing));
    assert.equal(takeAttemptedEmail(throwing), "");
    // Falls back to the user typing it, which is still submittable.
    assert.equal(canSubmitResend({ status: "idle", email: "a@b.com" }), true);
  });

  it("does nothing when there is no storage at all (SSR)", () => {
    assert.doesNotThrow(() => rememberAttemptedEmail("a@b.com", null));
    assert.equal(takeAttemptedEmail(null), "");
  });
});
