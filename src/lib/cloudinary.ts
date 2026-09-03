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

// Formats accepted through the shared (non-KYC) upload path — images for
// avatars/chat/products, plus the video formats the portfolio's own
// MediaType.VIDEO already assumes elsewhere in the app. Signing this as an
// upload param (not just checking it client-side) is what makes it an
// actual server-side control: previously the signature only covered
// {timestamp, folder, transformation}, so a client bypassing the
// browser's own `accept` check and calling Cloudinary directly with a
// valid signature could upload literally any file type Cloudinary
// accepts.
//
// No `max_file_size` alongside it — that isn't a real Cloudinary Upload
// API parameter (confirmed against the SDK's own type definitions; it
// doesn't appear anywhere in `node_modules/cloudinary`), only a doc-typo
// I nearly shipped. Signing a nonexistent param makes Cloudinary
// recompute a different hash than the one sent, so every upload would
// have failed with "Invalid Signature". File size is enforced by the
// Cloudinary account's own plan-level cap plus the client-side checks
// already in place (e.g. account-media.tsx's MAX_BYTES) — bypassable by
// a determined attacker calling Cloudinary directly, same residual gap
// as before this pass. A real server-side cap would need a post-upload
// check via Cloudinary's Admin API (`cloudinary.api.resource`, reading
// `bytes`) and deleting anything over the limit — not implemented here.
const ALLOWED_UPLOAD_FORMATS = "jpg,jpeg,png,webp,gif,mp4,mov,webm";

// Portfolio/product/chat images — public delivery type (the default).
// Never use this for KYC documents; see generateKycUploadSignature below,
// which is deliberately a separate function so the two can't be swapped
// by mistake at a call site.
export function generateUploadSignature(folder: string) {
  const timestamp = Math.round(Date.now() / 1000);
  // fl_strip_profile is an INCOMING transformation — it strips embedded
  // metadata (EXIF, including GPS coordinates; IPTC; XMP; ICC color
  // profile) from the asset Cloudinary actually stores, not just a
  // delivery-time view of it. Required for portfolio uploads (Prompt B5 —
  // a Model's GPS location leaking through a photo's EXIF is a real
  // safety risk, not just a privacy nicety) and applied to every upload
  // through this shared signature, since there's no case where keeping it
  // would be desirable.
  const transformation = "fl_strip_profile";
  const paramsToSign = {
    timestamp,
    folder,
    transformation,
    allowed_formats: ALLOWED_UPLOAD_FORMATS,
  };

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
    transformation,
    allowedFormats: ALLOWED_UPLOAD_FORMATS,
  };
}

export async function deleteCloudinaryAsset(
  publicId: string,
  resourceType: "image" | "video",
) {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

// Portfolio image size variants (thumbnail/medium/large) moved to
// src/lib/media-variants.ts — that file has zero imports so it's safe to
// use from Client Components, unlike this one (imports the Node-only
// `cloudinary` SDK at module scope).

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
// ID photos/selfies only, never video. No `max_file_size` here either —
// see the comment above ALLOWED_UPLOAD_FORMATS for why that's not a real
// Cloudinary param. Size stays enforced by verification-form.tsx's own
// client-side compression target (MAX_KYC_BYTES) plus Cloudinary's
// account-level cap, same residual gap noted above.
const KYC_ALLOWED_FORMATS = "jpg,jpeg,png,webp";

export function generateKycUploadSignature(userId: string) {
  const timestamp = Math.round(Date.now() / 1000);
  const folder = `${KYC_FOLDER_PREFIX}/${userId}`;
  const type = "authenticated" as const;
  // `type` must be part of the signed params — Cloudinary requires every
  // non-file param sent to the upload API to be included in the
  // signature, or the upload is rejected. This is what actually forces
  // the asset to land as delivery type "authenticated" rather than the
  // client being able to request public delivery.
  const paramsToSign = {
    timestamp,
    folder,
    type,
    allowed_formats: KYC_ALLOWED_FORMATS,
  };

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
    allowedFormats: KYC_ALLOWED_FORMATS,
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
