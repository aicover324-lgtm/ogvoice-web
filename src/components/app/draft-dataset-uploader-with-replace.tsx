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
}: {
  onDraftChange?: (asset: { id: string } | null) => void;
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

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">1) Dataset file</div>
        <Badge variant={locked ? "secondary" : "outline"}>{locked ? "uploaded" : "required"}</Badge>
      </div>

      <div className="mt-3">
        {locked ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Current dataset file</div>
              <div className="truncate text-sm font-medium">{draft.fileName}</div>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          className={cn(
            "relative w-full overflow-hidden rounded-2xl border border-dashed p-6 text-left transition-colors",
            "min-h-[240px]",
            "bg-[radial-gradient(70%_60%_at_30%_20%,hsl(var(--primary)/0.14),transparent_60%),radial-gradient(50%_40%_at_90%_10%,hsl(var(--chart-2)/0.16),transparent_60%)]",
            dragActive
              ? "border-primary bg-primary/5"
              : "border-border/70 hover:border-border hover:bg-accent/20"
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
          <div className="flex max-w-xl flex-col gap-2">
            <div className="text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
              {locked ? "Replace dataset" : "Upload dataset"}
            </div>
            <div className="text-sm text-muted-foreground">
              Drag and drop a single audio file here, or click to choose.
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
              <DialogTitle>Replace dataset file?</DialogTitle>
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
            toast.success("Dataset uploaded");
          }}
        />
      </div>
    </Card>
  );
}
