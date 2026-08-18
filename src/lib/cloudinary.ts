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

export async function deleteCloudinaryAsset(publicId: string, resourceType: "image" | "video") {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}
