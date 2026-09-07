import crypto from "node:crypto";

// Dormant while MOMO_ENABLED=false (src/lib/features.ts). No-ops
// gracefully when credentials aren't configured (this environment has
// none yet — see .env.example's MoMo section), matching the pattern
// already used for Stripe/Cloudinary/Resend — callers check
// isMomoConfigured() or catch MomoNotConfiguredError rather than crash.
const partnerCode = process.env.MOMO_PARTNER_CODE;
const accessKey = process.env.MOMO_ACCESS_KEY;
const secretKey = process.env.MOMO_SECRET_KEY;

export function isMomoConfigured() {
  return Boolean(partnerCode && accessKey && secretKey);
}

export class MomoNotConfiguredError extends Error {
  constructor() {
    super("MoMo isn't configured in this environment");
    this.name = "MomoNotConfiguredError";
  }
}

function requireMomoConfig() {
  if (!partnerCode || !accessKey || !secretKey)
    throw new MomoNotConfiguredError();
  return { partnerCode, accessKey, secretKey };
}

// Same v2 REST API on both hosts — only the hostname differs between
// MoMo's sandbox and production gateways. process.env.APP_ENV (not
// NODE_ENV — this needs to match Vercel Preview too, which runs a
// production build against the shared dev database) decides which one
// is used, so switching to real charges is purely an env-var change on
// Vercel, no code deploy needed, matching the "just enable it" goal.
// Unverified against MoMo's own docs beyond the sandbox host (this
// environment has no live merchant account to confirm the production
// host against) — double-check before the first live charge.
const MOMO_BASE_URL =
  process.env.APP_ENV === "production"
    ? "https://payment.momo.vn/v2/gateway/api"
    : "https://test-payment.momo.vn/v2/gateway/api";

function signHmacSha256(data: string, key: string) {
  return crypto.createHmac("sha256", key).update(data).digest("hex");
}

interface MomoCreatePaymentResult {
  payUrl: string;
  resultCode: number;
  message: string;
}

// Starts a one-time "captureWallet" checkout (MoMo's own docs are
// explicit this API is one-time-payment only — true recurring billing
// needs a separate, more involved "Tokenization Payments" API that
// isn't built here). amount is whole VND (MoMo, like Stripe, treats VND
// as zero-decimal — no ×100).
export async function createMomoPayment({
  orderId,
  amount,
  orderInfo,
  redirectUrl,
  ipnUrl,
}: {
  orderId: string;
  amount: number;
  orderInfo: string;
  redirectUrl: string;
  ipnUrl: string;
}): Promise<MomoCreatePaymentResult> {
  const config = requireMomoConfig();
  const requestId = orderId;
  const requestType = "captureWallet";
  const extraData = "";

  // MoMo requires this exact field order (alphabetical by key) with no
  // extra whitespace — a single field out of place produces a signature
  // that silently doesn't match, rejected by MoMo with no useful error.
  const rawSignature =
    `accessKey=${config.accessKey}&amount=${amount}&extraData=${extraData}` +
    `&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}` +
    `&partnerCode=${config.partnerCode}&redirectUrl=${redirectUrl}` +
    `&requestId=${requestId}&requestType=${requestType}`;
  const signature = signHmacSha256(rawSignature, config.secretKey);

  const res = await fetch(`${MOMO_BASE_URL}/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      partnerCode: config.partnerCode,
      partnerName: "Fgrapher",
      requestId,
      amount,
      orderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      lang: "vi",
      extraData,
      requestType,
      signature,
    }),
  });

  const body = (await res.json()) as MomoCreatePaymentResult;
  return body;
}

// IPN payload shape MoMo actually sends — see
// developers.momo.vn/v3/docs/payment/api/wallet/onetime's IPN section.
export interface MomoIpnPayload {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amount: number;
  orderInfo: string;
  orderType: string;
  transId: number;
  resultCode: number;
  message: string;
  payType: string;
  responseTime: number;
  extraData: string;
  signature: string;
}

// The IPN callback's signature covers a DIFFERENT, larger field set than
// the create-request signature above (includes orderInfo/orderType/
// message/payType/responseTime/transId, omits redirectUrl/requestType) —
// reusing the create-request template here would reject every genuine
// IPN call. Field order is alphabetical by key, same as above.
export function verifyMomoIpnSignature(payload: MomoIpnPayload): boolean {
  const config = requireMomoConfig();
  const rawSignature =
    `accessKey=${config.accessKey}&amount=${payload.amount}` +
    `&extraData=${payload.extraData}&message=${payload.message}` +
    `&orderId=${payload.orderId}&orderInfo=${payload.orderInfo}` +
    `&orderType=${payload.orderType}&partnerCode=${payload.partnerCode}` +
    `&payType=${payload.payType}&requestId=${payload.requestId}` +
    `&responseTime=${payload.responseTime}&resultCode=${payload.resultCode}` +
    `&transId=${payload.transId}`;
  const expected = signHmacSha256(rawSignature, config.secretKey);

  // Timing-safe comparison — a naive `===` leaks how many leading
  // characters matched via response-time differences, letting an
  // attacker brute-force the signature byte by byte.
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(payload.signature);
  return (
    expectedBuf.length === actualBuf.length &&
    crypto.timingSafeEqual(expectedBuf, actualBuf)
  );
}
