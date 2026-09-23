import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sendMessageSchema } from "@/lib/validations/message";
import { submitBankTransferProofSchema } from "@/lib/validations/payments";

describe("upload persistence contracts", () => {
  it("requires Cloudinary identity metadata for an image message", () => {
    const base = {
      conversationId: "conversation-1",
      content: "Ảnh tham khảo",
      type: "image" as const,
      mediaUrl: "https://res.cloudinary.com/demo/image/upload/chat.jpg",
    };

    assert.equal(sendMessageSchema.safeParse(base).success, false);
    assert.equal(
      sendMessageSchema.safeParse({
        ...base,
        mediaPublicId: "fgrapher/chat/user-1/chat",
      }).success,
      true,
    );
  });

  it("keeps plain text messages independent from upload metadata", () => {
    assert.equal(
      sendMessageSchema.safeParse({
        conversationId: "conversation-1",
        content: "Xin chào",
        type: "text",
      }).success,
      true,
    );
  });

  it("requires a public ID with a bank-transfer proof URL", () => {
    const base = {
      paymentId: "payment-1",
      proofUrl: "https://res.cloudinary.com/demo/image/upload/proof.jpg",
    };

    assert.equal(submitBankTransferProofSchema.safeParse(base).success, false);
    assert.equal(
      submitBankTransferProofSchema.safeParse({
        ...base,
        proofPublicId: "fgrapher/payment/user-1/proof",
      }).success,
      true,
    );
  });
});
