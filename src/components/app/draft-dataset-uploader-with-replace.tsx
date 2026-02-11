"use client";

import * as React from "react";
import { toast } from "sonner";
import { Repeat2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatasetUploader, type DatasetUploaderHandle } from "@/components/app/dataset-uploader";
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
  const [draft, setDraft] = React.useState<DraftAsset | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [replacing, setReplacing] = React.useState(false);
  const [dragActive, setDragActive] = React.useState(false);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);

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

  async function replace() {
    if (!draft?.id) return;
    setReplacing(true);
    // Delete *all* draft dataset assets for safety (covers older duplicates).
    const res = await fetch(`/api/uploads/draft`, { method: "DELETE" });
    const json = await res.json().catch(() => null);
    setReplacing(false);
    if (!res.ok || !json?.ok) {
      toast.error(json?.error?.message || "Could not replace file");
      return;
    }
    setDraft(null);
    onDraftChange?.(null);
    setOpen(false);

    if (pendingFile) {
      const file = pendingFile;
      setPendingFile(null);
      toast.success("Replacing... uploading new file");
      await uploaderRef.current?.uploadFiles([file]);
      return;
    }

    toast.success("Pick a new dataset file");
    setTimeout(() => uploaderRef.current?.openPicker(), 60);
  }

  function onChooseFile() {
    if (!draft) {
      uploaderRef.current?.openPicker();
      return;
    }
    setOpen(true);
  }

  function onDropFiles(files: FileList) {
    const file = files.item(0);
    if (!file) return;
    if (!draft) {
      void uploaderRef.current?.uploadFiles([file]);
      return;
    }
    setPendingFile(file);
    setOpen(true);
  }

  const locked = !!draft;
  const heading = title || "1. Singing Voice";

  return (
    <Card
      className={cn(
        "relative overflow-hidden rounded-2xl border border-black/5 bg-white/75 p-6 shadow-[0_12px_32px_rgba(2,8,23,0.10)] backdrop-blur-md",
        "dark:border-white/10 dark:bg-background/35 dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)]",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_10%_0%,rgba(6,182,212,0.10),transparent_55%),radial-gradient(70%_60%_at_90%_0%,rgba(217,70,239,0.08),transparent_55%)] dark:bg-[radial-gradient(80%_60%_at_10%_0%,rgba(6,182,212,0.18),transparent_55%),radial-gradient(70%_60%_at_90%_0%,rgba(217,70,239,0.14),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-black/7 dark:ring-white/10" />
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
            "border-black/8 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] backdrop-blur-md",
            "dark:border-white/12 dark:bg-background/25 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]",
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
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(75%_60%_at_15%_0%,rgba(6,182,212,0.12),transparent_55%),radial-gradient(70%_60%_at_90%_0%,rgba(217,70,239,0.10),transparent_55%)] dark:bg-[radial-gradient(75%_60%_at_15%_0%,rgba(6,182,212,0.18),transparent_55%),radial-gradient(70%_60%_at_90%_0%,rgba(217,70,239,0.14),transparent_55%)]" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/55 via-white/0 to-white/0 opacity-65 dark:from-white/10" />
          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-black/8 dark:ring-white/10" />
          <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-[radial-gradient(65%_55%_at_50%_10%,rgba(255,255,255,0.55),transparent_55%)] dark:bg-[radial-gradient(65%_55%_at_50%_10%,rgba(255,255,255,0.14),transparent_55%)]" />

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

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Replace voice file?</DialogTitle>
              <DialogDescription>
                This deletes the current file, then uploads the new one.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" className="rounded-full" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" className="rounded-full" onClick={replace} disabled={replacing}>
                {replacing ? "Replacing..." : "Replace"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
    </Card>
  );
}
