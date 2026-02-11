"use client";

import * as React from "react";
import { toast } from "sonner";
import { Repeat2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DatasetUploader, type DatasetUploaderHandle } from "@/components/app/dataset-uploader";
import { PremiumCard } from "@/components/app/premium-card";
import { cn } from "@/lib/utils";

type DraftAsset = {
  id: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
};

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
  const [dragActive, setDragActive] = React.useState(false);

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
  const heading = title || "1. Singing Voice";

  return (
    <PremiumCard className={cn("p-6", className)}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>{heading}</div>
        <Badge variant={locked ? "secondary" : "outline"}>{locked ? "uploaded" : "required"}</Badge>
      </div>

      <div className="mt-3">
        {locked ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Current voice file</div>
              <div className="truncate text-sm font-medium">{draft.fileName}</div>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          className={cn(
            "group relative w-full overflow-hidden rounded-2xl border p-6 text-left transition-all",
            "min-h-[288px]",
            // Neutral glass frame (no colored background)
            "border-black/10 bg-background/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-md",
            "dark:border-white/12 dark:bg-background/10 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
            "hover:border-black/12 hover:shadow-[0_18px_50px_rgba(2,8,23,0.10)]",
            "dark:hover:border-white/16 dark:hover:shadow-[0_22px_70px_rgba(0,0,0,0.40)]",
            "cursor-pointer",
            dragActive ? "ring-2 ring-primary/35" : "ring-0"
          )}
          onClick={onChooseFile}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(false);
            onDropFiles(e.dataTransfer.files);
          }}
        >
          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-black/8 dark:ring-white/10" />
          <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-gradient-to-b from-white/10 via-transparent to-transparent dark:from-white/6" />

          <div className="relative flex max-w-xl flex-col gap-2">
            <div className="text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
              {locked ? "Replace voice file" : "Upload voice file"}
            </div>
            <div className="text-sm text-muted-foreground">
              Drag and drop your singing recording here, or click to choose.
            </div>
            <div className="text-xs text-muted-foreground">Allowed: wav · One file only</div>
            <div className="mt-3 inline-flex w-fit items-center rounded-full border bg-background/40 px-3 py-1.5 text-xs text-muted-foreground">
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
            toast.success("Voice file uploaded");
          }}
        />
      </div>
    </PremiumCard>
  );
}
