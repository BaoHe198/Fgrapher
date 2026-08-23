import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export function isCloudinaryConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
  );
}

// Portfolio/product/chat images — public delivery type (the default).
// Never use this for KYC documents; see generateKycUploadSignature below,
// which is deliberately a separate function so the two can't be swapped
// by mistake at a call site.
export function generateUploadSignature(folder: string) {
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = { timestamp, folder };

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET as string,
  );

  return {
    timestamp,
    signature,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    folder,
  };
}

export async function deleteCloudinaryAsset(
  publicId: string,
  resourceType: "image" | "video",
) {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

// ============================================================================
// KYC / IDENTITY VERIFICATION (Prompt B3, docs/guides/
// fgrapher-danh-gia-va-prompt-sua-doi.md) — completely separate upload and
// delivery path from every other image in the app. ID photos/selfies are
// uploaded with Cloudinary delivery type "authenticated" into a top-level
// folder (`fgrapher-kyc/...`) that is never mixed with `fgrapher/portfolio/
// ...` etc., are never given a public URL, and can only ever be viewed
// through generateKycSignedUrl's short-lived signed link.
// ============================================================================

const KYC_FOLDER_PREFIX = "fgrapher-kyc";
const KYC_SIGNED_URL_TTL_SECONDS = 5 * 60;

export function generateKycUploadSignature(userId: string) {
  const timestamp = Math.round(Date.now() / 1000);
  const folder = `${KYC_FOLDER_PREFIX}/${userId}`;
  const type = "authenticated" as const;
  // `type` must be part of the signed params — Cloudinary requires every
  // non-file param sent to the upload API to be included in the
  // signature, or the upload is rejected. This is what actually forces
  // the asset to land as delivery type "authenticated" rather than the
  // client being able to request public delivery.
  const paramsToSign = { timestamp, folder, type };

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET as string,
  );

  return {
    timestamp,
    signature,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    folder,
    type,
  };
}

// Mints a signed, time-limited (5 minute) URL for viewing one KYC image —
// callers MUST log an AuditLog "VIEW_KYC_DOCUMENT" entry every time this
// is invoked (see services/admin.ts's getKycImageUrl). Uses Cloudinary's
// private_download_url utility rather than a plain sign_url delivery URL:
// the latter is only truly time-bound if the Cloudinary account has
// "token-based authentication" configured in its dashboard (an external
// setup step this environment can't perform), whereas private_download_url
// bakes expires_at into its own request signature independent of that
// account setting — see CLAUDE.md's Cloudinary section for the broader
// caveat that nothing touching Cloudinary has round-tripped against live
// credentials in this sandbox.
export function generateKycSignedUrl(publicId: string) {
  return cloudinary.utils.private_download_url(publicId, "jpg", {
    resource_type: "image",
    type: "authenticated",
    attachment: false,
    expires_at: Math.floor(Date.now() / 1000) + KYC_SIGNED_URL_TTL_SECONDS,
  });
}

export async function deleteKycAsset(publicId: string) {
  await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    type: "authenticated",
  });
}
