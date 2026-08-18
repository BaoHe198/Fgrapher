"use client";

import { Loader2, UploadCloud, X } from "lucide-react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const ACCEPT = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "video/mp4": [".mp4"],
  "video/quicktime": [".mov"],
};

interface PendingFile {
  file: File;
  title: string;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

interface UploadedMedia {
  id: string;
  url: string;
  type: "IMAGE" | "VIDEO";
  title: string | null;
}

interface UploadMediaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  onUploaded: (items: UploadedMedia[]) => void;
}

function uploadToCloudinary(
  file: File,
  signature: { cloudName: string; apiKey: string; timestamp: number; signature: string; folder: string },
  onProgress: (percent: number) => void,
) {
  return new Promise<{ secure_url: string; public_id: string; width?: number; height?: number; resource_type: string }>(
    (resolve, reject) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", signature.apiKey);
      formData.append("timestamp", String(signature.timestamp));
      formData.append("signature", signature.signature);
      formData.append("folder", signature.folder);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `https://api.cloudinary.com/v1_1/${signature.cloudName}/auto/upload`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error("Upload failed"));
        }
      };
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.send(formData);
    },
  );
}

export function UploadMediaModal({ open, onOpenChange, profileId, onUploaded }: UploadMediaModalProps) {
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onDrop = useCallback((accepted: File[]) => {
    setFiles((prev) => [
      ...prev,
      ...accepted.map((file) => ({ file, title: "", progress: 0, status: "pending" as const })),
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    multiple: true,
    validator: (file) => {
      const isVideo = file.type.startsWith("video/");
      const max = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      if (file.size > max) {
        return {
          code: "file-too-large",
          message: isVideo ? "Videos must be under 100MB" : "Images must be under 10MB",
        };
      }
      return null;
    },
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const setTitle = (index: number, title: string) => {
    setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, title } : f)));
  };

  const uploadAll = async () => {
    setIsSubmitting(true);

    const sigRes = await fetch("/api/upload/signature", { method: "POST" });
    const sigBody = await sigRes.json();

    if (!sigRes.ok) {
      setFiles((prev) =>
        prev.map((f) => ({ ...f, status: "error", error: sigBody.message ?? "Upload unavailable" })),
      );
      setIsSubmitting(false);
      return;
    }

    const uploaded: UploadedMedia[] = [];

    for (let i = 0; i < files.length; i++) {
      setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, status: "uploading" } : f)));

      try {
        const result = await uploadToCloudinary(files[i].file, sigBody.data, (percent) => {
          setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, progress: percent } : f)));
        });

        const type = result.resource_type === "video" ? "VIDEO" : "IMAGE";
        const saveRes = await fetch("/api/portfolio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profileId,
            url: result.secure_url,
            publicId: result.public_id,
            type,
            title: files[i].title || undefined,
            width: result.width,
            height: result.height,
          }),
        });
        const saveBody = await saveRes.json();
        if (saveRes.ok) {
          uploaded.push({
            id: saveBody.data.id,
            url: result.secure_url,
            type,
            title: files[i].title || null,
          });
        }

        setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, status: "done" } : f)));
      } catch {
        setFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, status: "error", error: "Upload failed" } : f)),
        );
      }
    }

    setIsSubmitting(false);
    onUploaded(uploaded);
    setFiles([]);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isSubmitting) {
          onOpenChange(next);
          if (!next) setFiles([]);
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload media</DialogTitle>
        </DialogHeader>

        <div
          {...getRootProps()}
          className={`flex flex-col items-center justify-center gap-2 rounded-[var(--fg-radius-md)] border-2 border-dashed p-8 text-center transition-colors duration-150 ${
            isDragActive ? "border-brand-primary text-brand-primary" : "border-border-default text-text-tertiary"
          }`}
        >
          <input {...getInputProps()} />
          <UploadCloud className="size-6" />
          <p className="text-body-sm">Drag files here, or click to browse</p>
          <p className="text-body-sm text-text-tertiary">Images up to 10MB, videos up to 100MB</p>
        </div>

        {files.length > 0 ? (
          <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
            {files.map((f, index) => (
              <div key={index} className="flex items-center gap-2.5 rounded-[var(--fg-radius-sm)] border border-border-default p-2.5">
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-body-sm font-semibold text-text-primary">
                      {f.file.name}
                    </span>
                    {f.status === "pending" ? (
                      <button type="button" onClick={() => removeFile(index)} aria-label="Remove file">
                        <X className="size-3.5 text-text-tertiary" />
                      </button>
                    ) : null}
                  </div>
                  {f.status === "pending" ? (
                    <Input
                      placeholder="Title (optional)"
                      value={f.title}
                      onChange={(e) => setTitle(index, e.target.value)}
                      className="mt-1.5"
                    />
                  ) : f.status === "uploading" ? (
                    <Progress value={f.progress} className="mt-1.5" />
                  ) : f.status === "error" ? (
                    <p className="mt-1 text-body-sm text-danger">{f.error}</p>
                  ) : (
                    <p className="mt-1 text-body-sm text-success">Uploaded</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <Button
          variant="accent"
          size="lg"
          className="w-full"
          disabled={files.length === 0 || isSubmitting}
          onClick={uploadAll}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Uploading...
            </>
          ) : (
            `Upload ${files.length || ""}`
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
