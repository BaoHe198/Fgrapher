import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canSubmitResend,
  rememberAttemptedEmail,
  takeAttemptedSignIn,
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

describe("attempted sign-in handoff", () => {
  it("gives the address back to the prompt", () => {
    const storage = fakeStorage();
    rememberAttemptedEmail("nguyen@example.com", "month", storage);
    assert.equal(takeAttemptedSignIn(storage).email, "nguyen@example.com");
  });

  it("carries the billing period through the redirect", () => {
    // NextAuth's redirect keeps only its own error params, so a year-plan
    // signup resending from the login page would otherwise be handed a
    // monthly link.
    const storage = fakeStorage();
    rememberAttemptedEmail("nguyen@example.com", "year", storage);
    assert.equal(takeAttemptedSignIn(storage).interval, "year");
  });

  it("defaults to monthly when no period was remembered", () => {
    const storage = fakeStorage();
    rememberAttemptedEmail("nguyen@example.com", undefined, storage);
    assert.equal(takeAttemptedSignIn(storage).interval, "month");
  });

  it("clears everything once read, so it doesn't outlive the attempt", () => {
    const storage = fakeStorage();
    rememberAttemptedEmail("nguyen@example.com", "year", storage);

    takeAttemptedSignIn(storage);

    assert.equal(storage.size(), 0);
    assert.deepEqual(takeAttemptedSignIn(storage), {
      email: "",
      interval: "month",
    });
  });

  it("returns an empty address when nothing was remembered", () => {
    assert.equal(takeAttemptedSignIn(fakeStorage()).email, "");
  });

  it("hands back a prefill that is immediately submittable", () => {
    const storage = fakeStorage();
    rememberAttemptedEmail("nguyen@example.com", "year", storage);

    const { email } = takeAttemptedSignIn(storage);

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

    assert.doesNotThrow(() =>
      rememberAttemptedEmail("a@b.com", "year", throwing),
    );
    assert.deepEqual(takeAttemptedSignIn(throwing), {
      email: "",
      interval: "month",
    });
    // Falls back to the user typing it, which is still submittable.
    assert.equal(canSubmitResend({ status: "idle", email: "a@b.com" }), true);
  });

  it("does nothing when there is no storage at all (SSR)", () => {
    assert.doesNotThrow(() => rememberAttemptedEmail("a@b.com", "year", null));
    assert.deepEqual(takeAttemptedSignIn(null), {
      email: "",
      interval: "month",
    });
  });
});
