import crypto from "node:crypto";

// Dormant while ZALOPAY_ENABLED=false (src/lib/features.ts). No-ops
// gracefully when credentials aren't configured, matching the pattern
// already used for Stripe/Cloudinary/Resend/MoMo — callers check
// isZalopayConfigured() or catch ZalopayNotConfiguredError.
//
// key1 signs OUTGOING requests (create order); key2 verifies INCOMING
// callbacks. Mixing them up is a real, easy-to-make mistake here — using
// key1 to "verify" a callback would make every callback (forged or not)
// fail signature checks, and using key2 to sign a request would make
// every create-order call fail with an invalid-mac error from ZaloPay.
const appId = process.env.ZALOPAY_APP_ID;
const key1 = process.env.ZALOPAY_KEY1;
const key2 = process.env.ZALOPAY_KEY2;

export function isZalopayConfigured() {
  return Boolean(appId && key1 && key2);
}

export class ZalopayNotConfiguredError extends Error {
  constructor() {
    super("ZaloPay isn't configured in this environment");
    this.name = "ZalopayNotConfiguredError";
  }
}

function requireZalopayConfig() {
  if (!appId || !key1 || !key2) throw new ZalopayNotConfiguredError();
  return { appId, key1, key2 };
}

// Same as MoMo's MOMO_BASE_URL — see that file's comment. Unverified
// against ZaloPay's own docs beyond the sandbox host; double-check
// before the first live charge.
const ZALOPAY_BASE_URL =
  process.env.APP_ENV === "production"
    ? "https://openapi.zalopay.vn/v2"
    : "https://sb-openapi.zalopay.vn/v2";

function hmacSha256Hex(data: string, key: string) {
  return crypto.createHmac("sha256", key).update(data).digest("hex");
}

// ZaloPay requires this exact format: "yymmdd_<orderId>", max 40 chars —
// undocumented as a hard validation rule until a create-order call
// mysteriously fails, so this is centralized here rather than left to
// every caller to remember.
export function buildAppTransId(orderId: string) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}_${orderId}`;
}

interface ZalopayCreateOrderResult {
  return_code: number; // 1 = success, 2 = failure, 3 = processing
  return_message: string;
  order_url?: string;
  zp_trans_token?: string;
}

// One-time payment only, same limitation as MoMo — ZaloPay's recurring
// support needs their separate "AgreementPay"/tokenization APIs, not
// built here. amount is whole VND (zero-decimal, no ×100).
export async function createZalopayOrder({
  appTransId,
  amount,
  appUser,
  description,
  callbackUrl,
  redirectUrl,
}: {
  appTransId: string;
  amount: number;
  appUser: string;
  description: string;
  callbackUrl: string;
  redirectUrl: string;
}): Promise<ZalopayCreateOrderResult> {
  const config = requireZalopayConfig();
  const appTime = Date.now();
  const embedData = JSON.stringify({ redirecturl: redirectUrl });
  const item = "[]";

  // Field order/separator is ZaloPay's own spec, not alphabetical like
  // MoMo's — a reordered field silently produces a wrong mac.
  const macInput = [
    config.appId,
    appTransId,
    appUser,
    amount,
    appTime,
    embedData,
    item,
  ].join("|");
  const mac = hmacSha256Hex(macInput, config.key1);

  const res = await fetch(`${ZALOPAY_BASE_URL}/create`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      app_id: config.appId,
      app_trans_id: appTransId,
      app_user: appUser,
      app_time: String(appTime),
      amount: String(amount),
      item,
      description,
      embed_data: embedData,
      callback_url: callbackUrl,
      mac,
    }),
  });

  return (await res.json()) as ZalopayCreateOrderResult;
}

// Parsed shape of the callback's inner `data` JSON string — see
// docs.zalopay.vn/docs/developer-tools/knowledge-base/callback.
export interface ZalopayCallbackData {
  app_id: number;
  app_trans_id: string;
  app_time: number;
  app_user: string;
  amount: number;
  embed_data: string;
  item: string;
  zp_trans_id: number;
  server_time: number;
  channel: number;
  merchant_user_id: string;
  zp_user_id: string;
  user_fee_amount: number;
  discount_amount: number;
}

// The callback body is `{ data: "<raw JSON string>", mac, type }` — the
// mac covers the exact raw `data` STRING as received, not a re-serialized
// version of the parsed object (JSON.stringify can reorder keys or
// change whitespace, which would silently break verification even for a
// genuine callback). Always pass the untouched string here, parse it
// separately only after this returns true.
export function verifyZalopayCallback(rawData: string, mac: string): boolean {
  const config = requireZalopayConfig();
  const expected = hmacSha256Hex(rawData, config.key2);

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(mac);
  return (
    expectedBuf.length === actualBuf.length &&
    crypto.timingSafeEqual(expectedBuf, actualBuf)
  );
}
