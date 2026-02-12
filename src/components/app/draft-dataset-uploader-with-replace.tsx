"use client";

import * as React from "react";
import { toast } from "sonner";
import { Repeat2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatasetUploader, type DatasetUploaderHandle, type DatasetUploadState } from "@/components/app/dataset-uploader";
import { PremiumCard } from "@/components/app/premium-card";
import { cn } from "@/lib/utils";

type DraftAsset = {
  id: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
};

const DATASET_ALLOWED_MIME = new Set(["audio/wav", "audio/x-wav"]);

function isValidDatasetWavFile(file: File) {
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".wav")) return false;
  if (!file.type) return true;
  return DATASET_ALLOWED_MIME.has(file.type.toLowerCase());
}

function draggedWavState(dt: DataTransfer): "valid" | "invalid" | "unknown" {
  const items = Array.from(dt.items || []);
  const fileItems = items.filter((item) => item.kind === "file");
  if (fileItems.length === 0) return "unknown";

  let sawValid = false;
  for (const item of fileItems) {
    const t = (item.type || "").toLowerCase();
    if (!t) continue;
    if (!DATASET_ALLOWED_MIME.has(t)) return "invalid";
    sawValid = true;
  }
  return sawValid ? "valid" : "unknown";
}

export function DraftDatasetUploaderWithReplace({
  onDraftChange,
  title,
  className,
}: {
  onDraftChange?: (asset: { id: string } | null) => void;
  title?: string;
  className?: string;
}) {
  const uploaderRef = React.useRef<DatasetUploaderHandle | null>(null);
  const pickerRef = React.useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = React.useState<DraftAsset | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [dragState, setDragState] = React.useState<"idle" | "valid" | "invalid">("idle");
  const [uploadState, setUploadState] = React.useState<DatasetUploadState>({ phase: "idle", progress: 0 });

  const loadDraft = React.useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/uploads/draft", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok || !json?.ok) return;
    const next = (json.data.asset || null) as DraftAsset | null;
    setDraft(next);
    onDraftChange?.(next ? { id: next.id } : null);
  }, [onDraftChange]);

  React.useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  async function clearDraft() {
    // Delete *all* draft dataset assets for safety (covers older duplicates).
    const res = await fetch(`/api/uploads/draft`, { method: "DELETE" });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      throw new Error(json?.error?.message || "Could not clear current file");
    }
    setDraft(null);
    onDraftChange?.(null);
  }

  function onChooseFile() {
    pickerRef.current?.click();
  }

  function onDropFiles(files: FileList) {
    const file = files.item(0);
    if (!file) return;
    if (!isValidDatasetWavFile(file)) {
      toast.error("Singing record must be a .wav file.");
      return;
    }

    void (async () => {
      try {
        if (draft) {
          toast.message("Replacing current file...");
          await clearDraft();
        }
        await uploaderRef.current?.uploadFiles([file]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not upload file");
      }
    })();
  }

  const locked = !!draft;
  const uploadBusy =
    uploadState.phase === "queued" ||
    uploadState.phase === "uploading" ||
    uploadState.phase === "confirming" ||
    uploadState.phase === "optimizing";
  const heading = title || "1. Singing Record";

  return (
    <PremiumCard className={cn("border-white/10 bg-[#101b37] p-5 text-slate-100", className)} ringClassName="ring-white/10">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>{heading}</div>
        <Badge
          variant={locked ? "secondary" : "outline"}
          className={locked ? "bg-white/10 text-slate-100" : "border-white/20 text-slate-300"}
        >
          {locked ? "Uploaded" : "Required"}
        </Badge>
      </div>

      <div className="mt-3">
        {uploadBusy ? (
          <div className="mb-3 flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full border-white/20 bg-white/5 text-slate-100 hover:bg-white/10 cursor-pointer"
              onClick={() => uploaderRef.current?.cancelUpload()}
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Cancel upload
            </Button>
          </div>
        ) : null}

        {uploadState.phase === "optimizing" ? (
          <div className="mb-3 text-xs font-medium text-cyan-200">Optimizing your recording...</div>
        ) : null}

        {locked ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="min-w-0">
              <div className="text-xs text-slate-400">Current singing record</div>
              <div className="truncate text-sm font-medium text-slate-100">{draft.fileName}</div>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          className={cn(
            "group relative w-full overflow-hidden rounded-2xl border p-6 text-left transition-all",
            "min-h-[288px]",
            "border-white/15 bg-white/[0.03] backdrop-blur-md",
            "hover:border-cyan-300/35 hover:shadow-[0_18px_50px_rgba(2,8,23,0.28)]",
            dragState === "invalid" ? "cursor-not-allowed" : "cursor-pointer",
            dragState === "valid" ? "ring-2 ring-cyan-300/40" : dragState === "invalid" ? "ring-2 ring-destructive/35" : "ring-0"
          )}
          onClick={onChooseFile}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const state = draggedWavState(e.dataTransfer);
            setDragState(state === "invalid" ? "invalid" : "valid");
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const state = draggedWavState(e.dataTransfer);
            const invalid = state === "invalid";
            e.dataTransfer.dropEffect = invalid ? "none" : "copy";
            setDragState(invalid ? "invalid" : "valid");
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragState("idle");
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragState("idle");
            onDropFiles(e.dataTransfer.files);
          }}
        >
          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/10" />
          <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-gradient-to-b from-white/8 via-transparent to-transparent" />

          <div className="relative flex max-w-xl flex-col gap-2">
            <div className="text-sm font-semibold text-slate-100" style={{ fontFamily: "var(--font-heading)" }}>
              {locked ? "Replace singing record" : "Upload singing record"}
            </div>
            <div className="text-sm text-slate-300">
              Drag and drop your singing recording here, or click to choose.
            </div>
            <div className="text-xs text-slate-400">Allowed: WAV only (one file)</div>
            <div className="mt-3 inline-flex w-fit items-center rounded-full border border-white/20 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-200">
              <Repeat2 className="mr-2 h-3.5 w-3.5" />
              {locked ? "Choose new file" : "Choose file"}
            </div>
          </div>
        </button>

        <input
          ref={pickerRef}
          type="file"
          accept="audio/wav,audio/x-wav,.wav"
          multiple={false}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            void (async () => {
              try {
                if (!isValidDatasetWavFile(f)) {
                  toast.error("Singing record must be a .wav file.");
                  return;
                }
                if (draft) {
                  toast.message("Replacing current file...");
                  await clearDraft();
                }
                await uploaderRef.current?.uploadFiles([f]);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not upload file");
              } finally {
                if (pickerRef.current) pickerRef.current.value = "";
              }
            })();
          }}
        />

        <DatasetUploader
          ref={uploaderRef}
          type="dataset_audio"
          requireVoiceProfileId={false}
          disabled={loading}
          hideButton
          ui="minimal"
          suppressSuccessToast
          disabledReason={
            loading ? "Loading..." : undefined
          }
          onAssetCreated={async () => {
            await loadDraft();
            toast.success("Singing record uploaded.");
          }}
          onUploadStateChange={(state) => {
            setUploadState(state);
          }}
        />
      </div>
    </PremiumCard>
  );
}
