"use client";

import { Loader2, Upload } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

async function uploadFile(file: File) {
  const sigRes = await fetch("/api/upload/signature", { method: "POST" });
  const sigBody = await sigRes.json();
  if (!sigRes.ok) throw new Error(sigBody.message ?? "Upload unavailable");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", sigBody.data.apiKey);
  formData.append("timestamp", String(sigBody.data.timestamp));
  formData.append("signature", sigBody.data.signature);
  formData.append("folder", sigBody.data.folder);
  formData.append("transformation", sigBody.data.transformation);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${sigBody.data.cloudName}/auto/upload`,
    {
      method: "POST",
      body: formData,
    },
  );
  const result = await res.json();
  if (!res.ok) throw new Error("Upload failed");
  return result.secure_url as string;
}

export function AccountMedia({
  initialAvatar,
  initialCoverImage,
}: {
  initialAvatar: string | null;
  initialCoverImage: string | null;
}) {
  const [avatar, setAvatar] = useState(initialAvatar);
  const [coverImage, setCoverImage] = useState(initialCoverImage);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File, target: "avatar" | "cover") => {
    setError(null);
    setUploading(target);
    try {
      const url = await uploadFile(file);
      if (target === "avatar") setAvatar(url);
      else setCoverImage(url);

      await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          target === "avatar" ? { avatar: url } : { coverImage: url },
        ),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-3/1 w-full overflow-hidden rounded-[var(--fg-radius-md)] bg-bg-sunken">
        {coverImage ? (
          <Image
            src={coverImage}
            alt=""
            fill
            className="object-cover"
            unoptimized
          />
        ) : null}
        <button
          type="button"
          onClick={() => coverInput.current?.click()}
          className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-body-sm text-white"
        >
          {uploading === "cover" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          Cover
        </button>
        <input
          ref={coverInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) =>
            e.target.files?.[0] && handleUpload(e.target.files[0], "cover")
          }
        />
      </div>

      <div className="-mt-10 ml-4 flex items-end gap-3">
        <div className="relative size-[104px] shrink-0 overflow-hidden rounded-full border-4 border-bg-surface bg-bg-sunken">
          {avatar ? (
            <Image
              src={avatar}
              alt=""
              fill
              className="object-cover"
              unoptimized
            />
          ) : null}
          <button
            type="button"
            onClick={() => avatarInput.current?.click()}
            className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity hover:opacity-100"
          >
            {uploading === "avatar" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
          </button>
          <input
            ref={avatarInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) =>
              e.target.files?.[0] && handleUpload(e.target.files[0], "avatar")
            }
          />
        </div>
      </div>

      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
    </div>
  );
}
