"use client";

import * as React from "react";
import { toast } from "sonner";
import { UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type UploadItem = {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "queued" | "uploading" | "confirming" | "done" | "error";
  error?: string;
};

const DATASET_ALLOWED_MIME = new Set(["audio/wav", "audio/x-wav"]);

function isValidDatasetWavFile(file: File) {
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".wav")) return false;
  if (!file.type) return true;
  return DATASET_ALLOWED_MIME.has(file.type.toLowerCase());
}

function formatBytes(n: number) {
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export type DatasetUploaderHandle = {
  openPicker: () => void;
  uploadFiles: (files: FileList | File[]) => Promise<void>;
  cancelUpload: () => void;
};

export type DatasetUploadState = {
  phase: "idle" | "queued" | "uploading" | "confirming" | "done" | "error" | "cancelled";
  progress: number;
  fileName?: string;
  fileSize?: number;
  error?: string;
};

class UploadCancelledError extends Error {
  constructor() {
    super("UPLOAD_CANCELLED");
    this.name = "UploadCancelledError";
  }
}

export const DatasetUploader = React.forwardRef<DatasetUploaderHandle, {
  voiceProfileId?: string;
  type: "dataset_audio" | "song_input";
  onComplete?: () => void;
  onAssetCreated?: (assetId: string) => void;
  onFilePicked?: (fileName: string) => void;
  onFileSelected?: (file: File) => void;
  onUploadStateChange?: (state: DatasetUploadState) => void;
  disabled?: boolean;
  disabledReason?: string;
  requireVoiceProfileId?: boolean;
  hideButton?: boolean;
  hideList?: boolean;
  buttonLabel?: string;
  ui?: "card" | "minimal";
  suppressSuccessToast?: boolean;
}>(function DatasetUploaderImpl(
  {
    voiceProfileId,
    type,
    onComplete,
    onAssetCreated,
    onFilePicked,
    onFileSelected,
    onUploadStateChange,
    disabled,
    disabledReason,
    requireVoiceProfileId,
    hideButton,
    hideList,
    buttonLabel,
    ui,
    suppressSuccessToast,
  },
  ref
) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [items, setItems] = React.useState<UploadItem[]>([]);
  const [busy, setBusy] = React.useState(false);
  const currentXhrRef = React.useRef<XMLHttpRequest | null>(null);
  const currentItemIdRef = React.useRef<string | null>(null);

  async function processFiles(fileList: FileList | File[]) {
    const files = Array.isArray(fileList) ? fileList : Array.from(fileList);
    if (!files || files.length === 0) return;
    if (disabled) {
      toast.error(disabledReason || "Uploads are disabled here.");
      return;
    }

    const needsVoice = requireVoiceProfileId ?? (type === "dataset_audio");
    if (needsVoice && type === "dataset_audio" && !voiceProfileId) {
      toast.error("Create a voice profile first.");
      return;
    }

    if (type === "dataset_audio" && files.length > 1) {
      toast.error("Dataset upload supports only 1 file.");
      return;
    }

    if (type === "dataset_audio") {
      const file = files[0];
      if (!file || !isValidDatasetWavFile(file)) {
        toast.error("Dataset must be a .wav file.");
        return;
      }
    }

    if (files[0]) {
      onFilePicked?.(files[0].name);
      onFileSelected?.(files[0]);
      onUploadStateChange?.({
        phase: "queued",
        progress: 0,
        fileName: files[0].name,
        fileSize: files[0].size,
      });
    }

    const next: UploadItem[] = files.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      size: f.size,
      progress: 0,
      status: "queued",
    }));
    // For dataset_audio we only ever want to show the current file.
    if (type === "dataset_audio") setItems(next);
    else setItems((prev) => [...next, ...prev]);

    setBusy(true);
    try {
      for (let i = 0; i < files.length; i += 1) {
        await uploadFile(files[i]!, next[i]!.id);
      }
      if (!suppressSuccessToast) {
        toast.success(type === "dataset_audio" ? "Dataset uploaded" : "Audio uploaded");
      }
      onComplete?.();
    } catch (e) {
      if (e instanceof UploadCancelledError) {
        toast.message("Upload cancelled.");
      } else {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      }
    } finally {
      currentXhrRef.current = null;
      currentItemIdRef.current = null;
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function cancelUpload() {
    const xhr = currentXhrRef.current;
    if (!xhr) return;
    xhr.abort();
  }

  React.useImperativeHandle(ref, () => ({
    openPicker: () => inputRef.current?.click(),
    uploadFiles: (files) => processFiles(files),
    cancelUpload,
  }));

  async function uploadFile(file: File, itemId: string) {
    currentItemIdRef.current = itemId;
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, status: "uploading", progress: 1 } : it)));
    onUploadStateChange?.({
      phase: "uploading",
      progress: 1,
      fileName: file.name,
      fileSize: file.size,
    });

    const presignRes = await fetch("/api/uploads/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voiceProfileId,
        type,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
      }),
    });

    const presignJson = await presignRes.json().catch(() => null);
    if (!presignRes.ok || !presignJson?.ok) {
      const msg = presignJson?.error?.message || "Failed to presign upload";
      setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, status: "error", error: msg } : it)));
      onUploadStateChange?.({
        phase: "error",
        progress: 0,
        fileName: file.name,
        fileSize: file.size,
        error: msg,
      });
      throw new Error(msg);
    }

    const { uploadUrl, storageKey, requiredHeaders } = presignJson.data as {
      uploadUrl: string;
      storageKey: string;
      requiredHeaders: Record<string, string>;
    };

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      currentXhrRef.current = xhr;
      xhr.open("PUT", uploadUrl);
      Object.entries(requiredHeaders || {}).forEach(([k, v]) => {
        xhr.setRequestHeader(k, v);
      });
        xhr.upload.onprogress = (evt) => {
          if (!evt.lengthComputable) return;
          const p = Math.round((evt.loaded / evt.total) * 90);
          setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, progress: Math.max(1, p) } : it)));
          onUploadStateChange?.({
            phase: "uploading",
            progress: Math.max(1, p),
            fileName: file.name,
            fileSize: file.size,
          });
        };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.onabort = () => {
        setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, status: "error", error: "Upload cancelled" } : it)));
        onUploadStateChange?.({
          phase: "cancelled",
          progress: 0,
          fileName: file.name,
          fileSize: file.size,
          error: "Upload cancelled",
        });
        reject(new UploadCancelledError());
      };
      xhr.send(file);
    });

    currentXhrRef.current = null;

    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, status: "confirming", progress: 95 } : it)));
    onUploadStateChange?.({
      phase: "confirming",
      progress: 95,
      fileName: file.name,
      fileSize: file.size,
    });
    const confirmRes = await fetch("/api/uploads/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voiceProfileId,
        type,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        storageKey,
      }),
    });
    const confirmJson = await confirmRes.json().catch(() => null);
    if (!confirmRes.ok || !confirmJson?.ok) {
      const msg = confirmJson?.error?.message || "Failed to confirm upload";
      setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, status: "error", error: msg } : it)));
      onUploadStateChange?.({
        phase: "error",
        progress: 95,
        fileName: file.name,
        fileSize: file.size,
        error: msg,
      });
      throw new Error(msg);
    }

    const assetId = confirmJson?.data?.asset?.id as string | undefined;
    if (assetId) onAssetCreated?.(assetId);

    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, status: "done", progress: 100 } : it)));
    onUploadStateChange?.({
      phase: "done",
      progress: 100,
      fileName: file.name,
      fileSize: file.size,
    });
  }

  async function onPickFiles(files: FileList | null) {
    if (!files) return;
    await processFiles(files);
  }

  React.useEffect(() => {
    return () => {
      if (currentXhrRef.current) currentXhrRef.current.abort();
    };
  }, []);

  React.useEffect(() => {
    if (!busy) return;
    return () => {
      if (currentXhrRef.current) currentXhrRef.current.abort();
    };
  }, [busy]);


  const chrome = ui !== "minimal";

  const inner = (
    <>
      <div className={cn(chrome ? "flex items-start justify-between gap-4" : "hidden")}
      >
        <div>
          <div className="text-sm font-semibold">
            {type === "dataset_audio" ? "Upload voice dataset" : "Upload song / audio"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Uses pre-signed URLs (direct to storage). Allowed: {type === "dataset_audio" ? "wav" : "wav/mp3/flac"}.
            {type === "dataset_audio" ? " One file only." : ""}
          </div>
          {disabledReason ? (
            <div className="mt-2 text-xs text-muted-foreground">{disabledReason}</div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {busy ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={cancelUpload}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel upload
            </Button>
          ) : null}
          {hideButton ? null : (
            <Button
              type="button"
              className="rounded-full"
              disabled={busy || disabled}
              onClick={() => inputRef.current?.click()}
            >
              <UploadCloud className="mr-2 h-4 w-4" />
              {busy ? "Uploading..." : buttonLabel || "Choose file"}
            </Button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={type === "dataset_audio" ? "audio/wav,audio/x-wav,.wav" : "audio/*,.wav,.mp3,.flac"}
        multiple={false}
        className="hidden"
        onChange={(e) => void onPickFiles(e.target.files)}
      />

      {!hideList && items.length > 0 ? (
        <div className={cn(chrome ? "mt-4" : "mt-0", "grid gap-3")}>
          {items.slice(0, 6).map((it) => (
            <div key={it.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{it.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {formatBytes(it.size)} · {it.status}
                    {it.error ? ` · ${it.error}` : ""}
                  </div>
                </div>
                <div className={cn("text-xs", it.status === "error" ? "text-destructive" : "text-muted-foreground")}>
                  {it.progress}%
                </div>
              </div>
              <div className="mt-2">
                <Progress value={it.progress} />
              </div>
            </div>
          ))}
          {items.length > 6 ? (
            <div className="text-xs text-muted-foreground">Showing latest 6 uploads.</div>
          ) : null}
        </div>
      ) : null}
    </>
  );

  return chrome ? <Card className="p-5">{inner}</Card> : <div>{inner}</div>;
});
