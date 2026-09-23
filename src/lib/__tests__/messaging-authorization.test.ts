import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sendMessageSchema } from "@/lib/validations/message";

describe("messaging authorization boundary", () => {
  it("keeps booking links out of the public message API", () => {
    const result = sendMessageSchema.safeParse({
      conversationId: "conversation-a",
      content: "Open booking",
      type: "booking_link",
      bookingId: "booking-owned-by-someone-else",
    });

    assert.equal(result.success, false);
  });

  it("still accepts user-created text messages", () => {
    const result = sendMessageSchema.safeParse({
      conversationId: "conversation-a",
      content: "Hello",
      type: "text",
    });

    assert.equal(result.success, true);
  });
});
