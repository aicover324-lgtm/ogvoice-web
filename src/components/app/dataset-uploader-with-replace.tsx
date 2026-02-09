"use client";

import * as React from "react";
import { toast } from "sonner";
import { Repeat2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DatasetUploader, type DatasetUploaderHandle } from "@/components/app/dataset-uploader";

export function DatasetUploaderWithReplace({
  voiceProfileId,
  hasDataset,
  currentFileName,
}: {
  voiceProfileId: string;
  hasDataset: boolean;
  currentFileName?: string | null;
}) {
  const router = useRouter();
  const uploaderRef = React.useRef<DatasetUploaderHandle | null>(null);
  const [locked, setLocked] = React.useState(hasDataset);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setLocked(hasDataset);
  }, [hasDataset]);

  async function replace() {
    setLoading(true);
    const res = await fetch(`/api/voices/${encodeURIComponent(voiceProfileId)}/dataset-assets`, { method: "DELETE" });
    const json = await res.json().catch(() => null);
    setLoading(false);

    if (!res.ok || !json?.ok) {
      toast.error(json?.error?.message || "Could not clear dataset");
      return;
    }

    toast.success("Dataset cleared. Choose a new file.");
    setLocked(false);
    setOpen(false);

    // Open picker after the dialog closes.
    setTimeout(() => {
      uploaderRef.current?.openPicker();
    }, 50);
  }

  return (
    <div className="grid gap-3">
      {locked ? (
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs text-muted-foreground">
            Current dataset file: <span className="text-foreground">{currentFileName || "(unknown)"}</span>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-full" size="sm">
                <Repeat2 className="mr-2 h-4 w-4" />
                Replace
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Replace dataset file?</DialogTitle>
                <DialogDescription>
                  This will delete the current dataset file, then prompt you to pick a new one.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" className="rounded-full" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" className="rounded-full" onClick={replace} disabled={loading}>
                  {loading ? "Replacing..." : "Replace"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ) : null}

      <DatasetUploader
        ref={uploaderRef}
        voiceProfileId={voiceProfileId}
        type="dataset_audio"
        disabled={locked}
        disabledReason={locked ? "Use Replace to upload a new dataset file." : undefined}
        onComplete={() => {
          // lock again; server refresh will show the new file in the list
          setLocked(true);
          router.refresh();
        }}
      />
    </div>
  );
}
