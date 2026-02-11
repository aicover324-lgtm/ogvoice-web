"use client";

import * as React from "react";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type UploadType = "avatar_image" | "voice_cover_image";
type PreviewVariant = "avatar" | "cover";

export type ImageUploaderHandle = {
  openPicker: () => void;
};

type PreviewConfig = {
  src: string;
  alt: string;
  variant: PreviewVariant;
  size?: number;
  width?: number | string;
  height?: number | string;
};

export const ImageUploader = React.forwardRef<ImageUploaderHandle, {
  type: UploadType;
  voiceProfileId?: string;
  onComplete?: () => void;
  onAssetCreated?: (asset: { id: string }) => void;
  buttonLabel?: string;
  preview?: PreviewConfig;
  trigger?: "button" | "frame";
  frameHint?: string | null;
  footerHint?: string | null;
  headless?: boolean;
}>(function ImageUploader(
  {
    type,
    voiceProfileId,
    onComplete,
    onAssetCreated,
    buttonLabel,
    preview,
    trigger,
    frameHint,
    footerHint,
    headless,
  },
  ref
) {
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

  const openPicker = React.useCallback(() => {
    if (busy) return;
    inputRef.current?.click();
  }, [busy]);

  React.useImperativeHandle(
    ref,
    () => ({
      openPicker,
    }),
    [openPicker]
  );

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

      const created = (confirmJson.data?.asset || null) as { id?: string } | null;

      setProgress(100);
      toast.success(type === "avatar_image" ? "Avatar updated" : "Cover updated");
      setPreviewKey(Date.now());
      setPreviewOk(true);
      if (created?.id) onAssetCreated?.({ id: String(created.id) });
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
  const previewWidth = preview?.width ?? previewSize;
  const previewHeight = preview?.height ?? previewSize;
  const effectiveTrigger: "button" | "frame" = trigger ?? "button";

  if (headless) {
    return (
      <>
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
      </>
    );
  }

  return (
    <div className="grid gap-2">
      {preview ? (
        <div className={effectiveTrigger === "frame" ? "grid gap-2" : "flex items-center gap-3"}>
          <button
            type="button"
            onClick={effectiveTrigger === "frame" ? openPicker : undefined}
            disabled={busy || effectiveTrigger !== "frame"}
            aria-label={type === "avatar_image" ? "Upload avatar" : "Upload cover"}
            className={
              preview.variant === "avatar"
                ? "group relative grid cursor-pointer place-items-center overflow-hidden rounded-full border bg-muted disabled:cursor-not-allowed"
                : "group relative grid cursor-pointer place-items-center overflow-hidden rounded-xl border bg-muted disabled:cursor-not-allowed w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            }
            style={{ width: previewWidth, height: previewHeight }}
          >
            {previewSrc && previewOk ? (
              // Use <img> (not next/image) to avoid remotePatterns issues with presigned redirects.
              // The API route returns a redirect to a short-lived signed URL.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewSrc}
                alt={preview.alt}
                className={busy ? "h-full w-full object-cover opacity-60" : "h-full w-full object-cover"}
                onError={() => setPreviewOk(false)}
              />
            ) : (
              <div className="grid place-items-center px-3 text-center">
                {effectiveTrigger === "frame" ? (
                  <div className="grid place-items-center gap-2">
                    <UploadCloud className="h-5 w-5 text-muted-foreground" />
                    <div className="text-xs text-muted-foreground">Click to upload</div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    {preview.variant === "avatar" ? "No avatar" : "No cover"}
                  </div>
                )}
              </div>
            )}

            {effectiveTrigger === "frame" && !busy ? (
              <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white">
                  {previewSrc && previewOk ? "Change" : "Upload"}
                </div>
              </div>
            ) : null}

            {busy ? (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="h-10 w-10 rounded-full border-2 border-white/25 border-t-white animate-spin" />
              </div>
            ) : null}
          </button>

          {effectiveTrigger === "frame" ? (
            frameHint === null ? null : (
              <div className="text-xs text-muted-foreground">
                {frameHint || "Click the square to upload. Replaces previous image."}
              </div>
            )
          ) : (
            <div className="min-w-0">
              <div className="text-sm font-medium">
                {type === "avatar_image" ? "Current avatar" : "Current cover"}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">Replaces previous image automatically.</div>
            </div>
          )}
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
      {effectiveTrigger === "button" ? (
        <Button type="button" variant="outline" className="rounded-full" disabled={busy} onClick={openPicker}>
          <UploadCloud className="mr-2 h-4 w-4" />
          {busy ? "Uploading..." : buttonLabel || (type === "avatar_image" ? "Upload avatar" : "Upload cover")}
        </Button>
      ) : null}
      {progress > 0 ? <Progress value={progress} /> : null}
      {footerHint === null ? null : (
        <div className="text-xs text-muted-foreground">
          {footerHint || "Optimized and stored as WEBP."}
        </div>
      )}
    </div>
  );
});
