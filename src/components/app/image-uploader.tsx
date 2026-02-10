"use client";

import * as React from "react";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type UploadType = "avatar_image" | "voice_cover_image";
type PreviewVariant = "avatar" | "cover";

type PreviewConfig = {
  src: string;
  alt: string;
  variant: PreviewVariant;
  size?: number;
};

export function ImageUploader({
  type,
  voiceProfileId,
  onComplete,
  buttonLabel,
  preview,
}: {
  type: UploadType;
  voiceProfileId?: string;
  onComplete?: () => void;
  buttonLabel?: string;
  preview?: PreviewConfig;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [previewKey, setPreviewKey] = React.useState(0);
  const [previewOk, setPreviewOk] = React.useState(true);

  React.useEffect(() => {
    // Initialize on client to avoid hydration mismatch.
    setPreviewKey(Date.now());
    setPreviewOk(true);
  }, []);

  async function upload(file: File) {
    setBusy(true);
    setProgress(1);
    try {
      const presignRes = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          voiceProfileId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
        }),
      });
      const presignJson = await presignRes.json().catch(() => null);
      if (!presignRes.ok || !presignJson?.ok) {
        throw new Error(presignJson?.error?.message || "Failed to presign upload");
      }

      const { uploadUrl, storageKey, requiredHeaders } = presignJson.data as {
        uploadUrl: string;
        storageKey: string;
        requiredHeaders: Record<string, string>;
      };

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        Object.entries(requiredHeaders || {}).forEach(([k, v]) => {
          xhr.setRequestHeader(k, v);
        });
        xhr.upload.onprogress = (evt) => {
          if (!evt.lengthComputable) return;
          const p = Math.round((evt.loaded / evt.total) * 90);
          setProgress(Math.max(1, p));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(file);
      });

      setProgress(95);
      const confirmRes = await fetch("/api/uploads/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          voiceProfileId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
          storageKey,
        }),
      });
      const confirmJson = await confirmRes.json().catch(() => null);
      if (!confirmRes.ok || !confirmJson?.ok) {
        throw new Error(confirmJson?.error?.message || "Failed to confirm upload");
      }

      setProgress(100);
      toast.success(type === "avatar_image" ? "Avatar updated" : "Cover updated");
      setPreviewKey(Date.now());
      setPreviewOk(true);
      onComplete?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
      setTimeout(() => setProgress(0), 800);
    }
  }

  const previewSrc = React.useMemo(() => {
    if (!preview?.src) return null;
    const join = preview.src.includes("?") ? "&" : "?";
    return `${preview.src}${join}v=${previewKey}`;
  }, [preview?.src, previewKey]);

  const previewSize = preview?.size ?? (preview?.variant === "avatar" ? 56 : 176);

  return (
    <div className="grid gap-2">
      {preview ? (
        <div className="flex items-center gap-3">
          <div
            className={
              preview.variant === "avatar"
                ? "grid place-items-center overflow-hidden rounded-full border bg-muted"
                : "grid place-items-center overflow-hidden rounded-xl border bg-muted"
            }
            style={{ width: previewSize, height: previewSize }}
          >
            {previewSrc && previewOk ? (
              // Use <img> (not next/image) to avoid remotePatterns issues with presigned redirects.
              // The API route returns a redirect to a short-lived signed URL.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewSrc}
                alt={preview.alt}
                className="h-full w-full object-cover"
                onError={() => setPreviewOk(false)}
              />
            ) : (
              <div className="px-3 text-center text-xs text-muted-foreground">
                {preview.variant === "avatar" ? "No avatar" : "No cover"}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium">
              {type === "avatar_image" ? "Current avatar" : "Current cover"}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">Replaces previous image automatically.</div>
          </div>
        </div>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          void upload(f);
        }}
      />
      <Button type="button" variant="outline" className="rounded-full" disabled={busy} onClick={() => inputRef.current?.click()}>
        <UploadCloud className="mr-2 h-4 w-4" />
        {busy ? "Uploading..." : buttonLabel || (type === "avatar_image" ? "Upload avatar" : "Upload cover")}
      </Button>
      {progress > 0 ? <Progress value={progress} /> : null}
      <div className="text-xs text-muted-foreground">Optimized and stored as WEBP.</div>
    </div>
  );
}
