// Client-only (createImageBitmap/canvas/document) — never import this from
// a Server Component. Extracted from what was a KYC-only helper in
// onboarding/verification/verification-form.tsx, now shared by every
// image-upload flow (avatar/cover, portfolio, chat, product photos,
// service-request references): none of them compressed anything client-side
// before this, so a modern phone's 10-20MB photo went to Cloudinary at full
// size every time — slow, especially on mobile networks, and the main
// upload-latency complaint this fixes.
export async function compressImageFile(
  file: File,
  {
    maxBytes,
    maxDimension,
    qualitySteps = [0.85, 0.7, 0.55, 0.4],
  }: { maxBytes: number; maxDimension: number; qualitySteps?: number[] },
): Promise<File> {
  if (file.size <= maxBytes) return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    maxDimension / Math.max(bitmap.width, bitmap.height),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  // Tries progressively lower quality until it fits; falls back to the
  // last (lowest-quality) attempt on the rare photo that still doesn't.
  let best: Blob | null = null;
  for (const quality of qualitySteps) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) continue;
    best = blob;
    if (blob.size <= maxBytes) break;
  }
  if (!best) return file;

  return new File([best], file.name.replace(/\.\w+$/, ".jpg"), {
    type: "image/jpeg",
  });
}
